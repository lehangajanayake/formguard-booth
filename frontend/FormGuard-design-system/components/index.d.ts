import type * as React from 'react';

/** Primary (Plate Red) at most once per screen; secondary (Iron Black) for other main actions; quiet for the rest. 48px tall by default. */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet';
  /** 'sm' is 36px tall, for dense desktop UI only. */
  size?: 'md' | 'sm';
  fullWidth?: boolean;
}
export declare function Button(props: ButtonProps): React.ReactElement;

/** Status label. 'fault' = red text with a filled dot; 'clear' = neutral 'In range' with a hollow dot. */
export interface FlagProps {
  tone?: 'fault' | 'clear';
  /** The words. Defaults to 'In range' (clear) or 'Fault'. Name the problem: 'Knees caving'. */
  children?: React.ReactNode;
  className?: string;
}
export declare function Flag(props: FlagProps): React.ReactElement;

/** One measured value, like a gauge reading. */
export interface ReadingProps {
  /** Joint or measure, shown uppercase: 'Left knee'. */
  label?: string;
  /** The number, without its unit: '12'. */
  value: React.ReactNode;
  /** '°', '° in', 's', '%'. */
  unit?: string;
  /** One line of context against the lifter's normal: 'Past your normal by 7°'. */
  note?: string;
  /** 'fault' only when the value is outside the lifter's normal range. */
  tone?: 'fault' | 'clear';
  className?: string;
}
export declare function Reading(props: ReadingProps): React.ReactElement;

export interface Rep {
  /** Depth reached, 0–1 of the lifter's normal full depth. */
  depth?: number;
  /** The fault's name if this rep had one: 'Knees caving'. Falsy = in range. */
  fault?: string | false;
}
/** Every rep in a set as a bar of its depth; fault reps red and numbered. */
export interface RepStripProps {
  reps: Rep[];
  /** 'Back squat · Set 3'. */
  label?: string;
  /** Overrides the computed '7/8 in range'. */
  summary?: string;
  className?: string;
}
export declare function RepStrip(props: RepStripProps): React.ReactElement;

/** The coaching cue shown with the earbud prompt. */
export interface CueCardProps {
  /** The joint and fault: 'Left knee caving'. */
  joint: string;
  /** The cue, five words or fewer, as spoken: 'Knees out.' */
  cue: string;
  /** The fix in one sentence. */
  fix?: string;
  /** 'Rep 6 · Set 3'. */
  meta?: string;
  className?: string;
}
export declare function CueCard(props: CueCardProps): React.ReactElement;

/** A joint on the body map. */
export interface JointMarkerProps {
  /** idle: not yet calibrated; tracked: being read, a dot inside a halo ring like the logo's; fault: off right now. */
  state?: 'idle' | 'tracked' | 'fault';
  /** Shown uppercase under the marker and used as its accessible name: 'L knee'. */
  label?: string;
  /** Pixels, default 32. Never below 24. */
  size?: number;
  className?: string;
}
export declare function JointMarker(props: JointMarkerProps): React.ReactElement;

declare global {
  interface Window {
    FormGuard: { Button: typeof Button; Flag: typeof Flag; Reading: typeof Reading; RepStrip: typeof RepStrip; CueCard: typeof CueCard; JointMarker: typeof JointMarker };
  }
}
