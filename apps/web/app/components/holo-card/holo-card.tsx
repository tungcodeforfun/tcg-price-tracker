import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { FACE_H, TERMINAL, initialOf, priceSize, titleSize, type FaceText } from "./face-layout";

export interface HoloCardProps extends FaceText {
  /** Sizes the box (width); the box keeps a 63:88 aspect and insets the card face 6% for tilt room. */
  className?: string;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function supportsWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return gl != null;
  } catch {
    return false;
  }
}

/**
 * A trading card rendered typographically as a phosphor screen. The server and no-JS/reduced-motion
 * clients get a static face; after hydration, capable clients swap in an interactive three.js card.
 */
export function HoloCard({ title, subtitle, price, className = "" }: HoloCardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const motionOk = useSyncExternalStore(
    subscribeReducedMotion,
    () => !window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );

  useEffect(() => {
    const host = hostRef.current;
    const stage = stageRef.current;
    if (!motionOk || !host || !stage || !supportsWebGL2()) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    import("./holo-scene")
      .then(({ mountHoloScene }) => {
        if (cancelled) return;
        dispose = mountHoloScene(host, stage, {
          title,
          subtitle,
          price,
          onReady: () => setLive(true),
          onLost: () => setLive(false),
        });
      })
      // Chunk failed to load or WebGL refused to start: the static face simply stays.
      .catch((error: unknown) => console.warn("HoloCard: 3D view unavailable", error));
    return () => {
      cancelled = true;
      dispose?.();
      setLive(false);
    };
  }, [motionOk, title, subtitle, price]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={[title, subtitle, price].filter(Boolean).join(". ")}
      className={`relative aspect-[63/88] touch-pan-y select-none ${className}`}
    >
      <div
        className={`@container absolute inset-[6%] transition-opacity duration-500 ${live ? "opacity-0" : ""}`}
      >
        <TerminalFace title={title} subtitle={subtitle} price={price} />
      </div>
      {motionOk && (
        <div
          ref={stageRef}
          aria-hidden
          className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${live ? "" : "opacity-0"}`}
        />
      )}
    </div>
  );
}

// Static face. Positions are in u (1u = 1cqw of the face) and match face-canvas.ts.

const u = (n: number) => `${n}cqw`;

interface TextProps {
  x: number;
  top: number;
  width: number;
  size: number;
  lineHeight: number;
  align?: "left" | "right" | "center";
  lines?: number;
  style?: CSSProperties;
  children: ReactNode;
}

/** An absolutely positioned text block; `x` is the left edge, or the right edge when right-aligned. */
function Text({
  x,
  top,
  width,
  size,
  lineHeight,
  align = "left",
  lines = 1,
  style,
  children,
}: TextProps) {
  const clamp: CSSProperties =
    lines === 1
      ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
      : {
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: lines,
          overflow: "hidden",
        };
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: u(align === "right" ? x - width : x),
        top: u(top),
        width: u(width),
        fontSize: u(size),
        lineHeight,
        textAlign: align,
        ...clamp,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Box({
  x,
  y,
  w,
  h,
  style,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  style: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{ position: "absolute", left: u(x), top: u(y), width: u(w), height: u(h), ...style }}
    />
  );
}

function FaceShell({
  background,
  shadow,
  children,
}: {
  background: string;
  shadow: string;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ borderRadius: u(4.8), background, boxShadow: shadow }}
    >
      {children}
    </div>
  );
}

function TerminalFace({ title, subtitle, price }: FaceText) {
  const c = TERMINAL;
  const titleU = titleSize(title);
  const bracket = (x: number, y: number, dx: number, dy: number, len: number, t: number) => [
    <Box
      key={`${x}${y}h`}
      x={dx > 0 ? x : x - len}
      y={dy > 0 ? y : y - t}
      w={len}
      h={t}
      style={{ background: c.phosphor }}
    />,
    <Box
      key={`${x}${y}v`}
      x={dx > 0 ? x : x - t}
      y={dy > 0 ? y : y - len}
      w={t}
      h={len}
      style={{ background: c.phosphor }}
    />,
  ];
  return (
    <FaceShell background={c.screen} shadow={`0 0 ${u(6)} -${u(1)} rgb(29 122 74 / 0.55)`}>
      <div style={{ fontFamily: c.mono, color: c.phosphor }}>
        <Box
          x={2.4}
          y={2.4}
          w={95.2}
          h={FACE_H - 4.8}
          style={{ border: `${u(0.3)} solid ${c.dim}`, borderRadius: u(2.4) }}
        />
        <Text
          x={7}
          top={6}
          width={86}
          size={3.3}
          lineHeight={1.2}
          style={{
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: c.dim,
            textTransform: "uppercase",
          }}
        >
          {subtitle}
        </Text>
        <Box
          x={7}
          y={12}
          w={86}
          h={68}
          style={{
            backgroundColor: c.panel,
            backgroundImage: [
              `linear-gradient(${c.dim}, ${c.dim})`,
              `linear-gradient(${c.dim}, ${c.dim})`,
              `linear-gradient(to right, ${c.grid} ${u(0.15)}, transparent ${u(0.15)})`,
              `linear-gradient(to bottom, ${c.grid} ${u(0.15)}, transparent ${u(0.15)})`,
            ].join(", "),
            backgroundSize: `${u(0.2)} 100%, 100% ${u(0.2)}, ${u(4.3)} 100%, 100% ${u(4.25)}`,
            backgroundPosition: `${u(42.9)} 0, 0 ${u(33.9)}, 0 0, 0 0`,
            backgroundRepeat: "no-repeat, no-repeat, repeat-x, repeat-y",
          }}
        />
        <Text
          x={0}
          top={21}
          width={100}
          size={50}
          lineHeight={1}
          align="center"
          style={{
            fontWeight: 800,
            color: "rgb(106 247 166 / 0.12)",
            WebkitTextStroke: `${u(0.35)} ${c.phosphor}`,
          }}
        >
          {initialOf(title)}
        </Text>
        {bracket(7, 12, 1, 1, 3, 0.5)}
        {bracket(93, 12, -1, 1, 3, 0.5)}
        {bracket(7, 80, 1, -1, 3, 0.5)}
        {bracket(93, 80, -1, -1, 3, 0.5)}
        <Text
          x={7}
          top={84}
          width={86}
          size={titleU}
          lineHeight={1.12}
          lines={2}
          style={{ fontWeight: 700, textTransform: "uppercase" }}
        >
          {title}
        </Text>
        <Box
          x={7}
          y={109.5}
          w={86}
          h={0.25}
          style={{
            background: `repeating-linear-gradient(90deg, ${c.dim} 0 ${u(1.2)}, transparent ${u(1.2)} ${u(2.1)})`,
          }}
        />
        <Text
          x={7}
          top={116}
          width={30}
          size={3.2}
          lineHeight={1}
          style={{ fontWeight: 500, letterSpacing: "0.08em", color: c.dim }}
        >
          MKT PRICE
        </Text>
        <Text
          x={93}
          top={124 - priceSize(price)}
          width={60}
          size={priceSize(price)}
          lineHeight={1}
          align="right"
          style={{ fontWeight: 700, color: c.amber }}
        >
          {price}
        </Text>
        {bracket(2.4, 2.4, 1, 1, 6, 0.7)}
        {bracket(97.6, 2.4, -1, 1, 6, 0.7)}
        {bracket(2.4, FACE_H - 2.4, 1, -1, 6, 0.7)}
        {bracket(97.6, FACE_H - 2.4, -1, -1, 6, 0.7)}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(to bottom, rgb(0 0 0 / 0.22) 0 ${u(0.45)}, transparent ${u(0.45)} ${u(1.27)})`,
          }}
        />
      </div>
    </FaceShell>
  );
}
