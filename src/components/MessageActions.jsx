import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import classes from "../pages/styling/messageActions.module.css";

/* ---------------------------------------------------------------------------
   MessageActions — Telegram-style message interaction.

   Telegram's model, which this follows:
     * Right-click (or long-press on touch) opens a context menu at the
       pointer — there is no permanent button strip sitting in the layout.
     * Double-click applies the quick reaction, so reacting needs no
       always-visible emoji button beside every message.
     * A floating quick-reaction bar sits above that menu, with a ⌄ that
       expands it into the full emoji picker.
     * Reply / Copy / Edit / Copy Message Link / Pin / Delete are menu rows
       with an icon on the left and the label beside it.
     * Editing does NOT happen inline here — it loads the message into the
       composer, so `onEdit` is a *request to start editing*, not a save.
     * Reactions render as pills tucked under the bubble, on the bubble's
       side of the row.

   The wrapper is a flex column that inherits the row's alignment, because
   .messageItem relies on `align-self: flex-end` to sit right for your own
   messages — wrapping it in a plain div broke that and was why the pill
   floated off to the container edge instead of hugging the bubble.
   --------------------------------------------------------------------------- */

const QUICK_EMOJI = ["😄", "🤣", "❤️", "👍", "👎", "🔥", "🥰"];

/* What a double-click sends, matching Telegram's default quick reaction. */
const QUICK_REACTION = "❤️";

/* Behind the ⌄ on the reaction bar, the way Telegram expands from its quick
   row to the full picker. Emoji only — no GIFs, per the user. */
const MORE_EMOJI = [
  "😀", "😅", "😊", "😍", "🤔", "😐", "😴", "😭",
  "😡", "🤯", "🥳", "😎", "🤝", "👏", "🙌", "💪",
  "🎉", "✨", "⭐", "💯", "✅", "❌", "👀", "🧠",
  "📚", "💡", "⏰", "🚀", "☕", "🍕", "😮", "🙏",
];

/* Rough first guess only. The real clamp happens in a layout effect once
   the layer has rendered and can be measured — hardcoding a width meant
   guessing at the reaction bar's size, and the guess drifts the moment the
   emoji set or the font changes. */
const LAYER_WIDTH_GUESS = 292;
const LAYER_HEIGHT_GUESS = 320;
const EDGE_GAP = 12;

const MessageActions = ({
  message,
  currentUserId,
  isOwnMessage,
  canEdit,
  canDelete,
  canPin,
  isPinned,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onReply,
  children,
}) => {
  const [menu, setMenu] = useState(null); // { x, y } in viewport coords
  const [showAllEmoji, setShowAllEmoji] = useState(false);
  const longPressRef = useRef(null);
  const menuRef = useRef(null);

  const closeMenu = useCallback(() => {
    setMenu(null);
    setShowAllEmoji(false);
  }, []);

  /* Anything that moves the menu away from the message it belongs to should
     dismiss it — a click elsewhere, Escape, or the conversation scrolling
     underneath it (the menu is viewport-positioned, so it would otherwise
     detach and hover over the wrong message). */
  useEffect(() => {
    if (!menu) return;
    const onKey = (e) => e.key === "Escape" && closeMenu();
    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [menu, closeMenu]);

  const openMenuAt = (clientX, clientY) => {
    const x = Math.min(clientX, window.innerWidth - LAYER_WIDTH_GUESS - EDGE_GAP);
    const y =
      clientY + LAYER_HEIGHT_GUESS > window.innerHeight
        ? Math.max(EDGE_GAP, clientY - LAYER_HEIGHT_GUESS)
        : clientY;
    setMenu({ x: Math.max(EDGE_GAP, x), y });
  };

  /* Correct the guess against what actually rendered, before the browser
     paints — so a menu opened near an edge never appears clipped, whatever
     the layer's real size turns out to be (the expanded emoji grid changes
     it substantially). */
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const box = menuRef.current.getBoundingClientRect();
    let { x, y } = menu;

    if (box.right > window.innerWidth - EDGE_GAP) {
      x = Math.max(EDGE_GAP, window.innerWidth - box.width - EDGE_GAP);
    }
    if (box.bottom > window.innerHeight - EDGE_GAP) {
      y = Math.max(EDGE_GAP, window.innerHeight - box.height - EDGE_GAP);
    }
    if (x !== menu.x || y !== menu.y) setMenu({ x, y });
  }, [menu, showAllEmoji]);

  /* Double-click applies the quick reaction, the way a double-tap does in
     Telegram — which is why there's no permanent emoji button hanging off
     every message. The full set is still a right-click away. */
  const handleDoubleClick = (e) => {
    e.preventDefault();
    onReact(message, QUICK_REACTION);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    openMenuAt(e.clientX, e.clientY);
  };

  // Touch equivalent of right-click: hold for half a second.
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    longPressRef.current = setTimeout(
      () => openMenuAt(touch.clientX, touch.clientY),
      500,
    );
  };
  const cancelLongPress = () => {
    clearTimeout(longPressRef.current);
    longPressRef.current = null;
  };

  const react = (emoji) => {
    onReact(message, emoji);
    closeMenu();
  };

  const reactions = message.reactions || [];
  const sideClass = isOwnMessage ? classes.own : classes.other;

  return (
    <div
      className={`${classes.wrapper} ${sideClass}`}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      <div className={classes.messageLine}>{children}</div>

      {reactions.length > 0 && (
        <div className={classes.reactionRow}>
          {reactions.map((r) => {
            const mine = (r.user_ids || []).includes(currentUserId);
            return (
              <button
                key={r.emoji}
                className={`${classes.reactionPill} ${mine ? classes.mine : ""}`}
                onClick={() => onReact(message, r.emoji)}
                title={mine ? "Remove your reaction" : "React"}
              >
                <span className={classes.reactionEmoji}>{r.emoji}</span>
                <span className={classes.reactionCount}>{r.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {menu && (
        <div
          ref={menuRef}
          className={classes.menuLayer}
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Telegram floats the quick-reaction strip as its own rounded bar
              above the menu, so it can be wider than the menu and never has
              to clip or scroll its emoji. */}
          <div className={classes.reactionBar}>
            {QUICK_EMOJI.map((emoji) => (
              <button
                key={emoji}
                className={classes.reactionBarBtn}
                onClick={() => react(emoji)}
              >
                {emoji}
              </button>
            ))}
            <button
              className={classes.reactionBarExpand}
              title={showAllEmoji ? "Fewer" : "More emoji"}
              onClick={() => setShowAllEmoji((v) => !v)}
            >
              <i
                className={showAllEmoji ? "ti ti-chevron-up" : "ti ti-chevron-down"}
              ></i>
            </button>
          </div>

          {showAllEmoji && (
            <div className={classes.emojiGrid}>
              {MORE_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  className={classes.reactionBarBtn}
                  onClick={() => react(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div className={classes.contextMenu}>
            <button
              className={classes.menuItem}
              onClick={() => {
                onReply?.(message);
                closeMenu();
              }}
            >
              <i className="ti ti-arrow-back-up"></i> Reply
            </button>

            {message.content && (
              <button
                className={classes.menuItem}
                onClick={() => {
                  navigator.clipboard?.writeText(message.content).catch(() => {});
                  closeMenu();
                }}
              >
                <i className="ti ti-copy"></i> Copy
              </button>
            )}

            {canEdit && (
              <button
                className={classes.menuItem}
                onClick={() => {
                  /* Hands the message to the composer — Telegram edits
                     there, not in place in the conversation. */
                  onEdit?.(message);
                  closeMenu();
                }}
              >
                <i className="ti ti-pencil"></i> Edit
              </button>
            )}

            <button
              className={classes.menuItem}
              onClick={() => {
                const link = `${window.location.origin}/chat?message=${message.id}`;
                navigator.clipboard?.writeText(link).catch(() => {});
                closeMenu();
              }}
            >
              <i className="ti ti-link"></i> Copy Message Link
            </button>

            {canPin && (
              <button
                className={classes.menuItem}
                onClick={() => {
                  onPin(message);
                  closeMenu();
                }}
              >
                <i className="ti ti-pin"></i> {isPinned ? "Unpin" : "Pin"}
              </button>
            )}

            {canDelete && (
              <button
                className={`${classes.menuItem} ${classes.danger}`}
                onClick={() => {
                  onDelete(message);
                  closeMenu();
                }}
              >
                <i className="ti ti-trash"></i> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageActions;
