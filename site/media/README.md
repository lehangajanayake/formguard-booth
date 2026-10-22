The booth clips are paired with the matching recorded sessions:

- `clean-curl.mp4` → clean curl recording
- `elbow-swing.mp4` → swinging arm recording

The video is the playback clock. Clean-curl playback starts at the third curl and aligns that moment with the recording’s first IMU sample; earlier curls are skipped. The swinging-arm clip is aligned to its matching motion. Scrubbing updates the copied live FormGuard 3D arm and sensor readings from timestamped samples. Both clips are muted and displayed at their portrait aspect ratio. The video analysis used to prepare the alignment is kept behind the scenes.
