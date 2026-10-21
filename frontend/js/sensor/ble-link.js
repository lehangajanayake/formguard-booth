// Web Bluetooth link to one FormGuard sensor board. Packet layout and UUIDs must match embedded/src/main.cpp.
export const UUID = {
  service: 'e3a10000-4f6c-4b8e-9a3d-7c2f1b5d8a01',
  orient: 'e3a10001-4f6c-4b8e-9a3d-7c2f1b5d8a01',
  command: 'e3a10002-4f6c-4b8e-9a3d-7c2f1b5d8a01',
  status: 'e3a10003-4f6c-4b8e-9a3d-7c2f1b5d8a01',
  battery: 'e3a10004-4f6c-4b8e-9a3d-7c2f1b5d8a01',
};

const CMD_CALIBRATE = 1;
const CMD_SLEEP = 2;
const BATT_USB = 1, BATT_CHARGING = 2;   // flags byte of the battery packet: u16 mV, u8 percent, u8 flags
const STATUS_CALIBRATING = 1;
const PACKET_BYTES = 13;   // u8 seq, u32 board ms, int16 w,x,y,z scaled by 32767 (little-endian)

/**
 * @typedef {object} Battery
 * @property {number} mv
 * @property {number} percent   estimated from the voltage; reads high while charging
 * @property {boolean} usb      USB power is plugged in
 * @property {boolean} charging
 */

/** Short battery text such as "82%", "charging 64%" or "charged". Empty when the board hasn't reported one. */
export function describeBattery(b) {
  if (!b) return '';
  if (b.charging) return `charging ${b.percent}%`;
  if (b.usb) return 'charged';
  return `${b.percent}%`;
}

/**
 * Events: 'connecting', 'connected', 'disconnected', 'packet' ({w,x,y,z,seq,tMs}, unit quaternion),
 * 'ready' (the board finished calibrating itself), 'stats' ({rateHz, lost}, once a second), 'battery' (Battery).
 */
export class SensorLink {
  /** @param {{name?: string}} [opts] `name` limits the device chooser to the board advertising that name */
  constructor({ name } = {}) {
    this.name = name || null;
    this.device = null;
    this.commandChar = null;
    this.connecting = false;
    /** @type {Battery | null} null until the board reports, or with firmware that has no battery characteristic */
    this.battery = null;
    /** The board was put to sleep from here and hasn't been reconnected since. */
    this.asleep = false;
    this.lastPacketAt = 0;
    this.rateHz = 0;
    this.lost = 0;
    this._listeners = {};
    this._lastSeq = -1;
    this._packetCount = 0;
    this._boardCalibrating = false;
    setInterval(() => {
      this.rateHz = this._packetCount; this._packetCount = 0;
      this._emit('stats', { rateHz: this.rateHz, lost: this.lost });
    }, 1000);
  }

  static get supported() { return typeof navigator !== 'undefined' && !!navigator.bluetooth; }
  get connected() { return !!(this.device && this.device.gatt.connected); }
  get deviceName() { return this.device?.name || null; }
  msSincePacket() { return this.lastPacketAt ? performance.now() - this.lastPacketAt : Infinity; }

  /** Subscribes to an event. Returns a function that unsubscribes. */
  on(event, fn) {
    (this._listeners[event] ||= new Set()).add(fn);
    return () => this._listeners[event].delete(fn);
  }

  /** Resolves true when `event` fires, or false after `timeoutMs`. */
  once(event, timeoutMs) {
    return new Promise(resolve => {
      const timer = setTimeout(() => { off(); resolve(false); }, timeoutMs);
      const off = this.on(event, () => { clearTimeout(timer); off(); resolve(true); });
    });
  }

  _emit(event, payload) { this._listeners[event]?.forEach(fn => fn(payload)); }

  /** Opens the browser's device chooser and connects. Returns false if the chooser was dismissed. */
  async connect() {
    if (!SensorLink.supported) throw new Error('Web Bluetooth needs Chrome or Edge, served from localhost or https.');
    let device;
    try {
      const filter = { services: [UUID.service], ...(this.name && { name: this.name }) };
      device = await navigator.bluetooth.requestDevice({ filters: [filter] });
    } catch (e) {
      if (e.name === 'NotFoundError') return false;
      throw e;
    }
    this.device = device; this.connecting = true; this._emit('connecting');
    device.addEventListener('gattserverdisconnected', () => this._handleDisconnect(), { once: true });
    try {
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(UUID.service);
      const orient = await service.getCharacteristic(UUID.orient);
      const status = await service.getCharacteristic(UUID.status);
      this.commandChar = await service.getCharacteristic(UUID.command);
      const battery = await service.getCharacteristic(UUID.battery).catch(() => null);   // older firmware has none
      if (battery) {
        battery.addEventListener('characteristicvaluechanged', e => this._handleBattery(e.target.value));
        await battery.startNotifications();
        this._handleBattery(await battery.readValue());
      }
      orient.addEventListener('characteristicvaluechanged', e => this._handlePacket(e.target.value));
      status.addEventListener('characteristicvaluechanged', e => this._handleStatus(e.target.value));
      await status.startNotifications();
      await orient.startNotifications();
      this._lastSeq = -1; this._packetCount = 0; this.lost = 0; this.lastPacketAt = 0;
      this.connecting = false; this.asleep = false;
      this._emit('connected');
      return true;
    } catch (e) {
      this.connecting = false;
      if (device.gatt.connected) device.gatt.disconnect(); else this._handleDisconnect();
      throw e;
    }
  }

  disconnect() { if (this.connected) this.device.gatt.disconnect(); }

  /** Asks the board to recalibrate its gyro and reseed its orientation. Listen for 'ready' afterwards. */
  async sendCalibrate() {
    this._boardCalibrating = false;
    await this.commandChar.writeValueWithResponse(Uint8Array.of(CMD_CALIBRATE));
  }

  /** Puts the board to sleep. It drops the connection itself, and wakes when the board is double-tapped. */
  async sendSleep() {
    this.asleep = true;
    try {
      await this.commandChar.writeValueWithResponse(Uint8Array.of(CMD_SLEEP));
    } catch (e) {
      if (this.connected) { this.asleep = false; throw e; }   // otherwise the board hung up before the reply: it is asleep
    }
  }

  _handleDisconnect() {
    this.device = null; this.commandChar = null; this.connecting = false; this.lastPacketAt = 0; this.battery = null;
    this._emit('disconnected');
  }

  _handleStatus(view) {
    const calibrating = view.getUint8(0) === STATUS_CALIBRATING;
    if (calibrating) this._boardCalibrating = true;
    else if (this._boardCalibrating) { this._boardCalibrating = false; this._emit('ready'); }
  }

  _handleBattery(view) {
    if (view.byteLength < 4) return;
    const flags = view.getUint8(3);
    this.battery = { mv: view.getUint16(0, true), percent: view.getUint8(2), usb: !!(flags & BATT_USB), charging: !!(flags & BATT_CHARGING) };
    this._emit('battery', this.battery);
  }

  _handlePacket(view) {
    if (view.byteLength < PACKET_BYTES) return;
    const seq = view.getUint8(0);
    if (this._lastSeq >= 0) this.lost += (seq - this._lastSeq - 1) & 255;
    this._lastSeq = seq; this._packetCount++; this.lastPacketAt = performance.now();
    const [w, x, y, z] = [5, 7, 9, 11].map(o => view.getInt16(o, true) / 32767);
    const n = Math.hypot(w, x, y, z);
    if (n < 1e-3) return;
    this._emit('packet', { w: w / n, x: x / n, y: y / n, z: z / n, seq, tMs: view.getUint32(1, true) });
  }
}
