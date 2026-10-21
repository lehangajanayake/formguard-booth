#include <Arduino.h>
#include <Wire.h>
#include <bluefruit.h>
#include "LSM6DS3.h"

#ifndef DEBUG_SERIAL
#define DEBUG_SERIAL 1  // 1 = also log over USB serial (only written while a host has the port open)
#endif
#ifndef DEVICE_NAME
#define DEVICE_NAME "FormGuard-Fore"
#endif

#if DEBUG_SERIAL
#define DBG(...) do { if (Serial) Serial.printf(__VA_ARGS__); } while (0)
#else
#define DBG(...) do {} while (0)
#endif

LSM6DS3 imu(I2C_MODE, 0x6A);

// UUID bytes are little-endian. Strings: service e3a10000-4f6c-4b8e-9a3d-7c2f1b5d8a01, then ...0001 orientation, ...0002 command, ...0003 status,
// ...0004 battery.
#define FG_UUID(n) {0x01, 0x8a, 0x5d, 0x1b, 0x2f, 0x7c, 0x3d, 0x9a, 0x8e, 0x4b, 0x6c, 0x4f, (n), 0x00, 0xa1, 0xe3}
const uint8_t UUID_SERVICE[16] = FG_UUID(0x00);
const uint8_t UUID_ORIENT[16] = FG_UUID(0x01);
const uint8_t UUID_CMD[16] = FG_UUID(0x02);
const uint8_t UUID_STATUS[16] = FG_UUID(0x03);
const uint8_t UUID_BATTERY[16] = FG_UUID(0x04);

const uint8_t CMD_CALIBRATE = 0x01, CMD_SLEEP = 0x02;
const uint8_t STATUS_READY = 0, STATUS_CALIBRATING = 1;

// Notification payload, 13 bytes: sequence number, board time in ms, quaternion w,x,y,z scaled by 32767.
struct __attribute__((packed)) QuatPacket {
  uint8_t seq;
  uint32_t tMs;
  int16_t q[4];
};

// Battery payload, 4 bytes: millivolts, estimated percent, flags.
const uint8_t BATT_USB = 0x01, BATT_CHARGING = 0x02;
struct __attribute__((packed)) BatteryPacket {
  uint16_t mv;
  uint8_t percent;
  uint8_t flags;
};

// XIAO battery pins (Arduino numbers from the variant): ~CHG is low while the BQ25101 charges.
const uint8_t PIN_CHG = 23;
const uint32_t BATTERY_PERIOD_MS = 2000;

BLEService fgService(UUID_SERVICE);
BLECharacteristic orientChar(UUID_ORIENT);
BLECharacteristic cmdChar(UUID_CMD);
BLECharacteristic statusChar(UUID_STATUS);
BLECharacteristic batteryChar(UUID_BATTERY);

volatile bool calibrateRequested = false;
volatile bool sleepRequested = false;
volatile bool centralConnected = false;
volatile uint32_t cmdFlashUntil = 0;
uint32_t txFailures = 0;

float roll = 0, pitch = 0, yaw = 0;
float gbx = 0, gby = 0, gbz = 0;
uint32_t lastUs;
uint8_t printDiv = 0;
float orientation[4] = {1, 0, 0, 0};
float orientationCovariance[4][4] = {};

void normalizeOrientationAndCovariance() {
  float norm = sqrtf(orientation[0] * orientation[0] + orientation[1] * orientation[1] +
                     orientation[2] * orientation[2] + orientation[3] * orientation[3]);
  if (norm < 1e-6f) return;

  float unit[4];
  float jacobian[4][4];
  float intermediate[4][4] = {};
  float normalizedCovariance[4][4] = {};
  for (int i = 0; i < 4; i++) unit[i] = orientation[i] / norm;
  for (int row = 0; row < 4; row++) {
    for (int column = 0; column < 4; column++) {
      jacobian[row][column] = ((row == column ? 1.0f : 0.0f) - unit[row] * unit[column]) / norm;
    }
  }
  for (int row = 0; row < 4; row++) {
    for (int column = 0; column < 4; column++) {
      for (int k = 0; k < 4; k++) intermediate[row][column] += jacobian[row][k] * orientationCovariance[k][column];
    }
  }
  for (int row = 0; row < 4; row++) {
    for (int column = 0; column < 4; column++) {
      for (int k = 0; k < 4; k++) normalizedCovariance[row][column] += intermediate[row][k] * jacobian[column][k];
      orientationCovariance[row][column] = normalizedCovariance[row][column];
    }
    orientation[row] = unit[row];
  }
}

void setOrientationFromEuler(float rollRad, float pitchRad, float yawRad) {
  float cr = cosf(rollRad * 0.5f), sr = sinf(rollRad * 0.5f);
  float cp = cosf(pitchRad * 0.5f), sp = sinf(pitchRad * 0.5f);
  float cy = cosf(yawRad * 0.5f), sy = sinf(yawRad * 0.5f);

  orientation[0] = cr * cp * cy + sr * sp * sy;
  orientation[1] = sr * cp * cy - cr * sp * sy;
  orientation[2] = cr * sp * cy + sr * cp * sy;
  orientation[3] = cr * cp * sy - sr * sp * cy;

  for (int i = 0; i < 4; i++) {
    for (int j = 0; j < 4; j++) orientationCovariance[i][j] = i == j ? 0.02f : 0.0f;
  }
  normalizeOrientationAndCovariance();
}

void updateEulerAngles() {
  float qw = orientation[0], qx = orientation[1], qy = orientation[2], qz = orientation[3];
  float sinPitch = 2.0f * (qw * qy - qz * qx);
  sinPitch = constrain(sinPitch, -1.0f, 1.0f);
  roll = atan2f(2.0f * (qw * qx + qy * qz), 1.0f - 2.0f * (qx * qx + qy * qy)) * RAD_TO_DEG;
  pitch = asinf(sinPitch) * RAD_TO_DEG;
  yaw = atan2f(2.0f * (qw * qz + qx * qy), 1.0f - 2.0f * (qy * qy + qz * qz)) * RAD_TO_DEG;
}

bool invert3x3(const float matrix[3][3], float inverse[3][3]) {
  float a = matrix[0][0], b = matrix[0][1], c = matrix[0][2];
  float d = matrix[1][0], e = matrix[1][1], f = matrix[1][2];
  float g = matrix[2][0], h = matrix[2][1], i = matrix[2][2];
  float determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (fabsf(determinant) < 1e-9f) return false;

  float scale = 1.0f / determinant;
  inverse[0][0] = (e * i - f * h) * scale;
  inverse[0][1] = (c * h - b * i) * scale;
  inverse[0][2] = (b * f - c * e) * scale;
  inverse[1][0] = (f * g - d * i) * scale;
  inverse[1][1] = (a * i - c * g) * scale;
  inverse[1][2] = (c * d - a * f) * scale;
  inverse[2][0] = (d * h - e * g) * scale;
  inverse[2][1] = (b * g - a * h) * scale;
  inverse[2][2] = (a * e - b * d) * scale;
  return true;
}

void updateOrientationEKF(float gx, float gy, float gz, float ax, float ay, float az, float dt) {
  if (dt <= 0.0f) return;
  if (dt > 0.1f) dt = 0.1f;

  float oldQ[4] = {orientation[0], orientation[1], orientation[2], orientation[3]};
  float omegaMagnitude = sqrtf(gx * gx + gy * gy + gz * gz);
  float halfAngle = 0.5f * omegaMagnitude * dt;
  float deltaScale = omegaMagnitude > 1e-6f ? sinf(halfAngle) / omegaMagnitude : 0.5f * dt;
  float deltaQ[4] = {cosf(halfAngle), gx * deltaScale, gy * deltaScale, gz * deltaScale};

  orientation[0] = oldQ[0] * deltaQ[0] - oldQ[1] * deltaQ[1] - oldQ[2] * deltaQ[2] - oldQ[3] * deltaQ[3];
  orientation[1] = oldQ[0] * deltaQ[1] + oldQ[1] * deltaQ[0] + oldQ[2] * deltaQ[3] - oldQ[3] * deltaQ[2];
  orientation[2] = oldQ[0] * deltaQ[2] - oldQ[1] * deltaQ[3] + oldQ[2] * deltaQ[0] + oldQ[3] * deltaQ[1];
  orientation[3] = oldQ[0] * deltaQ[3] + oldQ[1] * deltaQ[2] - oldQ[2] * deltaQ[1] + oldQ[3] * deltaQ[0];

  float transition[4][4] = {
    {1, -0.5f * gx * dt, -0.5f * gy * dt, -0.5f * gz * dt},
    {0.5f * gx * dt, 1, 0.5f * gz * dt, -0.5f * gy * dt},
    {0.5f * gy * dt, -0.5f * gz * dt, 1, 0.5f * gx * dt},
    {0.5f * gz * dt, 0.5f * gy * dt, -0.5f * gx * dt, 1}
  };
  float intermediate[4][4] = {};
  float predictedCovariance[4][4] = {};
  float processVariance = 0.25f * 0.0004f * dt * dt;
  for (int row = 0; row < 4; row++) {
    for (int column = 0; column < 4; column++) {
      for (int k = 0; k < 4; k++) intermediate[row][column] += transition[row][k] * orientationCovariance[k][column];
    }
  }
  for (int row = 0; row < 4; row++) {
    for (int column = 0; column < 4; column++) {
      for (int k = 0; k < 4; k++) predictedCovariance[row][column] += intermediate[row][k] * transition[column][k];
    }
    predictedCovariance[row][row] += processVariance;
  }

  float accelMagnitude = sqrtf(ax * ax + ay * ay + az * az);
  if (accelMagnitude > 1e-6f && fabsf(accelMagnitude - 1.0f) < 0.3f) {
    float measurement[3] = {ax / accelMagnitude, ay / accelMagnitude, az / accelMagnitude};
    float qw = orientation[0], qx = orientation[1], qy = orientation[2], qz = orientation[3];
    float expected[3] = {
      2.0f * (qx * qz - qw * qy),
      2.0f * (qw * qx + qy * qz),
      1.0f - 2.0f * (qx * qx + qy * qy)
    };
    float observationJacobian[3][4] = {
      {-2.0f * qy, 2.0f * qz, -2.0f * qw, 2.0f * qx},
      {2.0f * qx, 2.0f * qw, 2.0f * qz, 2.0f * qy},
      {0.0f, -4.0f * qx, -4.0f * qy, 0.0f}
    };
    float measurementVariance = 0.0025f + 8.0f * (accelMagnitude - 1.0f) * (accelMagnitude - 1.0f);
    float innovationCovariance[3][3] = {};
    float covarianceTimesJacobian[4][3] = {};

    for (int row = 0; row < 3; row++) {
      for (int column = 0; column < 3; column++) {
        for (int i = 0; i < 4; i++) {
          for (int j = 0; j < 4; j++) {
            innovationCovariance[row][column] += observationJacobian[row][i] * predictedCovariance[i][j] * observationJacobian[column][j];
          }
        }
      }
      innovationCovariance[row][row] += measurementVariance;
    }

    for (int row = 0; row < 4; row++) {
      for (int column = 0; column < 3; column++) {
        for (int k = 0; k < 4; k++) covarianceTimesJacobian[row][column] += predictedCovariance[row][k] * observationJacobian[column][k];
      }
    }

    float inverseInnovation[3][3];
    if (invert3x3(innovationCovariance, inverseInnovation)) {
      float gain[4][3] = {};
      float innovation[3] = {measurement[0] - expected[0], measurement[1] - expected[1], measurement[2] - expected[2]};
      for (int row = 0; row < 4; row++) {
        for (int column = 0; column < 3; column++) {
          for (int k = 0; k < 3; k++) gain[row][column] += covarianceTimesJacobian[row][k] * inverseInnovation[k][column];
          orientation[row] += gain[row][column] * innovation[column];
        }
      }

      float correction[4][4] = {};
      float leftProduct[4][4] = {};
      float updatedCovariance[4][4] = {};
      for (int row = 0; row < 4; row++) {
        for (int column = 0; column < 4; column++) {
          correction[row][column] = row == column ? 1.0f : 0.0f;
          for (int k = 0; k < 3; k++) correction[row][column] -= gain[row][k] * observationJacobian[k][column];
        }
      }
      for (int row = 0; row < 4; row++) {
        for (int column = 0; column < 4; column++) {
          for (int k = 0; k < 4; k++) leftProduct[row][column] += correction[row][k] * predictedCovariance[k][column];
        }
      }
      for (int row = 0; row < 4; row++) {
        for (int column = 0; column < 4; column++) {
          for (int k = 0; k < 4; k++) updatedCovariance[row][column] += leftProduct[row][k] * correction[column][k];
          for (int k = 0; k < 3; k++) updatedCovariance[row][column] += gain[row][k] * measurementVariance * gain[column][k];
          orientationCovariance[row][column] = updatedCovariance[row][column];
        }
      }
    } else {
      for (int row = 0; row < 4; row++) {
        for (int column = 0; column < 4; column++) orientationCovariance[row][column] = predictedCovariance[row][column];
      }
    }
  } else {
    for (int row = 0; row < 4; row++) {
      for (int column = 0; column < 4; column++) orientationCovariance[row][column] = predictedCovariance[row][column];
    }
  }

  normalizeOrientationAndCovariance();
  updateEulerAngles();
}

// The XIAO's RGB LED is active-low.
void setLed(bool red, bool green, bool blue) {
  digitalWrite(LED_RED, !red);
  digitalWrite(LED_GREEN, !green);
  digitalWrite(LED_BLUE, !blue);
}

// Board must be still: re-measures gyro bias and reseeds orientation from gravity.
void calibrateImu() {
  setLed(true, false, true);
  DBG("calibrating: keep the board still\n");
  const int N = 200;
  gbx = gby = gbz = 0;
  for (int i = 0; i < N; i++) {
    gbx += imu.readFloatGyroX();
    gby += imu.readFloatGyroY();
    gbz += imu.readFloatGyroZ();
    delay(5);
  }
  gbx /= N; gby /= N; gbz /= N;

  float ax = imu.readFloatAccelX(), ay = imu.readFloatAccelY(), az = imu.readFloatAccelZ();
  float accRoll = atan2f(ay, az);
  float accPitch = atan2f(-ax, sqrtf(ay * ay + az * az));
  setOrientationFromEuler(accRoll, accPitch, 0.0f);
  updateEulerAngles();
  lastUs = micros();
}

void onConnect(uint16_t connHandle) {
  centralConnected = true;
  DBG("ble: connected\n");
}

void onDisconnect(uint16_t connHandle, uint8_t reason) {
  centralConnected = false;
  DBG("ble: disconnected (reason 0x%02X), advertising again\n", reason);
}

void onCommand(uint16_t connHandle, BLECharacteristic* chr, uint8_t* data, uint16_t len) {
  cmdFlashUntil = millis() + 150;
  if (len >= 1 && data[0] == CMD_CALIBRATE) calibrateRequested = true;
  if (len >= 1 && data[0] == CMD_SLEEP) sleepRequested = true;
  DBG("ble: command 0x%02X\n", len ? data[0] : 0);
}

void startBle() {
  Bluefruit.begin();
  Bluefruit.setTxPower(4);
  Bluefruit.setName(DEVICE_NAME);
  Bluefruit.Periph.setConnectCallback(onConnect);
  Bluefruit.Periph.setDisconnectCallback(onDisconnect);
  Bluefruit.Periph.setConnInterval(6, 12);  // 7.5-15 ms; the host picks the final value

  fgService.begin();

  orientChar.setProperties(CHR_PROPS_NOTIFY);
  orientChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  orientChar.setFixedLen(sizeof(QuatPacket));
  orientChar.begin();

  cmdChar.setProperties(CHR_PROPS_WRITE | CHR_PROPS_WRITE_WO_RESP);
  cmdChar.setPermission(SECMODE_NO_ACCESS, SECMODE_OPEN);
  cmdChar.setFixedLen(1);
  cmdChar.setWriteCallback(onCommand);
  cmdChar.begin();

  statusChar.setProperties(CHR_PROPS_READ | CHR_PROPS_NOTIFY);
  statusChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  statusChar.setFixedLen(1);
  statusChar.begin();
  statusChar.write8(STATUS_READY);

  batteryChar.setProperties(CHR_PROPS_READ | CHR_PROPS_NOTIFY);
  batteryChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  batteryChar.setFixedLen(sizeof(BatteryPacket));
  batteryChar.begin();

  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();
  Bluefruit.Advertising.addService(fgService);
  Bluefruit.ScanResponse.addName();
  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(32, 244);
  Bluefruit.Advertising.setFastTimeout(30);
  Bluefruit.Advertising.start(0);
}

void setStatus(uint8_t state) {
  statusChar.write8(state);
  statusChar.notify8(state);
}

void setupBattery() {
  pinMode(VBAT_ENABLE, OUTPUT);
  digitalWrite(VBAT_ENABLE, LOW);  // keep LOW for good: driving it HIGH puts the battery voltage on P0.31
  pinMode(PIN_CHARGING_CURRENT, OUTPUT);
  digitalWrite(PIN_CHARGING_CURRENT, LOW);  // 100 mA charging (HIGH = 50 mA); 0.25C for the 400 mAh cell
  pinMode(PIN_CHG, INPUT_PULLUP);
  analogReference(AR_DEFAULT);  // 0..3.6 V
  analogReadResolution(12);
}

// Resting LiPo voltage to charge left. Rough: the voltage sags under load and reads high while charging.
uint8_t lipoPercent(uint16_t mv) {
  static const uint16_t MV[] = {3300, 3500, 3600, 3650, 3700, 3750, 3800, 3900, 4000, 4100, 4200};
  static const uint8_t PCT[] = {0, 2, 5, 10, 18, 30, 42, 62, 79, 90, 100};
  if (mv <= MV[0]) return 0;
  for (int i = 1; i < 11; i++) {
    if (mv <= MV[i]) return PCT[i - 1] + (PCT[i] - PCT[i - 1]) * (mv - MV[i - 1]) / (MV[i] - MV[i - 1]);
  }
  return 100;
}

BatteryPacket readBattery() {
  static float smoothedMv = 0;
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) sum += analogRead(PIN_VBAT);
  float mv = sum / 16.0f * (3600.0f / 4096.0f) * (1510.0f / 510.0f);  // 1M / 510k divider
  smoothedMv = smoothedMv == 0 ? mv : smoothedMv + 0.2f * (mv - smoothedMv);

  uint32_t usbStatus = 0;
  sd_power_usbregstatus_get(&usbStatus);
  BatteryPacket packet;
  packet.mv = (uint16_t)lroundf(smoothedMv);
  packet.percent = lipoPercent(packet.mv);
  packet.flags = 0;
  if (usbStatus & POWER_USBREGSTATUS_VBUSDETECT_Msk) {
    packet.flags |= BATT_USB;
    if (digitalRead(PIN_CHG) == LOW) packet.flags |= BATT_CHARGING;
  }
  return packet;
}

void updateBattery() {
  BatteryPacket packet = readBattery();
  batteryChar.write(&packet, sizeof(packet));
  if (batteryChar.notifyEnabled()) batteryChar.notify(&packet, sizeof(packet));
}

// Accelerometer double-tap on INT1 wakes the board from System OFF; values follow ST's double-tap example (AN5130).
void armTapWake() {
  imu.writeRegister(LSM6DS3_ACC_GYRO_CTRL2_G, 0x00);      // gyro off
  imu.writeRegister(LSM6DS3_ACC_GYRO_CTRL1_XL, 0x60);     // accel 416 Hz, ±2 g
  imu.writeRegister(LSM6DS3_ACC_GYRO_CTRL6_C, 0x10);      // accel low-power / normal mode
  imu.writeRegister(LSM6DS3_ACC_GYRO_TAP_CFG1, 0x8E);     // interrupts on, tap on X, Y and Z
  imu.writeRegister(LSM6DS3_ACC_GYRO_TAP_THS_6D, 0x0C);   // tap threshold 12 x FS/32 = 0.75 g
  imu.writeRegister(LSM6DS3_ACC_GYRO_INT_DUR2, 0x7F);     // double-tap gap, quiet and shock windows
  imu.writeRegister(LSM6DS3_ACC_GYRO_WAKE_UP_THS, 0x80);  // double tap on (not just single)
  imu.writeRegister(LSM6DS3_ACC_GYRO_MD1_CFG, 0x08);      // double tap -> INT1
}

// Undoes armTapWake's interrupt routing in case the IMU kept its registers through the sleep.
void disarmTapWake() {
  imu.writeRegister(LSM6DS3_ACC_GYRO_MD1_CFG, 0x00);
  imu.writeRegister(LSM6DS3_ACC_GYRO_WAKE_UP_THS, 0x00);
  imu.writeRegister(LSM6DS3_ACC_GYRO_TAP_CFG1, 0x00);
  imu.writeRegister(LSM6DS3_ACC_GYRO_CTRL6_C, 0x00);
}

// Drops the connection and enters System OFF. The board wakes by rebooting, so this never returns.
void goToSleep() {
  DBG("sleeping: double-tap to wake\n");
  Bluefruit.Advertising.restartOnDisconnect(false);
  Bluefruit.Advertising.stop();
  if (Bluefruit.connected()) {
    Bluefruit.Connection(Bluefruit.connHandle())->disconnect();
    uint32_t t = millis();
    while (Bluefruit.connected() && millis() - t < 500) delay(10);
  }
  setLed(false, false, false);
  armTapWake();
  delay(50);  // let the accelerometer settle so a stale event doesn't wake it at once
#if DEBUG_SERIAL
  Serial.flush();
#endif
  systemOff(PIN_LSM6DS3TR_C_INT1, HIGH);  // INT1 is active high
  while (true) {}
}

void setup() {
  setupBattery();
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);
  setLed(false, false, false);
#if DEBUG_SERIAL
  Serial.begin(115200);
  uint32_t t = millis();
  while (!Serial && millis() - t < 1500) delay(10);
#endif

  status_t initStatus = imu.begin();
  uint8_t whoAmI = 0, ctrl1Xl = 0, ctrl2G = 0, ctrl3C = 0;
  status_t whoStatus = imu.readRegister(&whoAmI, 0x0F);
  status_t ctrl1Status = imu.readRegister(&ctrl1Xl, 0x10);
  status_t ctrl2Status = imu.readRegister(&ctrl2G, 0x11);
  status_t ctrl3Status = imu.readRegister(&ctrl3C, 0x12);
  DBG("begin=%d WHO_AM_I=%d:0x%02X CTRL1_XL=%d:0x%02X CTRL2_G=%d:0x%02X CTRL3_C=%d:0x%02X\n",
      initStatus, whoStatus, whoAmI, ctrl1Status, ctrl1Xl, ctrl2Status, ctrl2G, ctrl3Status, ctrl3C);

  if (initStatus != IMU_SUCCESS) {
    DBG("IMU init failed\n");
    while (true) {  // red fast blink
      setLed(true, false, false);
      delay(150);
      setLed(false, false, false);
      delay(150);
    }
  }

  disarmTapWake();
  startBle();
  updateBattery();
  calibrateImu();
}

void loop() {
  static uint8_t seq = 0, sendDiv = 0;

#if DEBUG_SERIAL
  while (Serial.available()) {
    if (Serial.read() == 'C') calibrateRequested = true;  // same as the BLE command
  }
#endif

  if (sleepRequested) goToSleep();

  if (calibrateRequested) {
    calibrateRequested = false;
    setStatus(STATUS_CALIBRATING);
    calibrateImu();
    setStatus(STATUS_READY);
    DBG("calibration done\n");
  }

  uint32_t ms = millis();
  static uint32_t lastBatteryMs = 0;
  if (ms - lastBatteryMs >= BATTERY_PERIOD_MS) {
    lastBatteryMs = ms;
    updateBattery();
  }

  if (ms < cmdFlashUntil) setLed(false, false, true);                      // blue flash: command received
  else if (!centralConnected) setLed(false, false, (ms / 500) % 2 == 0);   // blue slow blink: advertising
  else if (!orientChar.notifyEnabled()) setLed(false, true, true);         // cyan: connected, page not subscribed yet
  else setLed(false, (ms % 1000) < 100, false);                            // green pulse: streaming

  float ax = imu.readFloatAccelX(), ay = imu.readFloatAccelY(), az = imu.readFloatAccelZ();  // g
  float gx = imu.readFloatGyroX() - gbx;
  float gy = imu.readFloatGyroY() - gby;
  float gz = imu.readFloatGyroZ() - gbz;  // deg/s

  uint32_t now = micros();
  float dt = (now - lastUs) * 1e-6f;
  lastUs = now;

  updateOrientationEKF(gx * (PI / 180.0f), gy * (PI / 180.0f), gz * (PI / 180.0f), ax, ay, az, dt);

  if (++sendDiv >= 2 && orientChar.notifyEnabled()) {  // ~50 Hz at a ~100 Hz loop
    sendDiv = 0;
    QuatPacket packet;
    packet.seq = seq++;
    packet.tMs = ms;
    for (int i = 0; i < 4; i++) packet.q[i] = (int16_t)lroundf(constrain(orientation[i], -1.0f, 1.0f) * 32767.0f);
    if (!orientChar.notify(&packet, sizeof(packet))) txFailures++;
  }

  if (++printDiv >= 50) {  // ~2 Hz debug line
    printDiv = 0;
    DBG("ble=%d notify=%d txFail=%lu | ax:%.3f ay:%.3f az:%.3f gx:%.2f gy:%.2f gz:%.2f | roll:%.1f pitch:%.1f yaw:%.1f\n",
        centralConnected, orientChar.notifyEnabled(), (unsigned long)txFailures, ax, ay, az, gx, gy, gz, roll, pitch, yaw);
  }
  delay(10);
}