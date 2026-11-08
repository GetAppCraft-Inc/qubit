package com.tanmaysinghx.qubit.proctor;

/**
 * Integrity events reported by the exam client or raised by the server.
 * {@code counts} = whether it consumes the exam's violation tolerance.
 */
public enum ViolationType {
    TAB_HIDDEN(true, "Switched away from the exam tab or minimised the window"),
    WINDOW_BLUR(true, "Exam window lost focus"),
    FULLSCREEN_EXIT(true, "Exited full-screen mode"),
    DEVTOOLS(true, "Developer tools detected"),
    MULTI_SCREEN(true, "An additional display was detected"),
    SCREEN_CAPTURE(true, "Screen capture key pressed"),
    SESSION_CHANGED(true, "Exam was opened in another tab, window or device"),
    CONNECTION_LOST(true, "Connection to the exam server was lost for too long"),
    COPY_PASTE(false, "Copy / paste attempt blocked"),
    CONTEXT_MENU(false, "Right-click blocked"),
    SHORTCUT(false, "Blocked keyboard shortcut"),
    DISCONNECTED(false, "Connection dropped"),
    RECONNECTED(false, "Connection restored"),
    ADMIN_TERMINATED(true, "Terminated by an invigilator");

    /** Event types the exam client is allowed to report (the rest are raised server-side). */
    public static final java.util.Set<ViolationType> CLIENT_REPORTABLE = java.util.EnumSet.of(
            TAB_HIDDEN, WINDOW_BLUR, FULLSCREEN_EXIT, DEVTOOLS, MULTI_SCREEN, SCREEN_CAPTURE,
            COPY_PASTE, CONTEXT_MENU, SHORTCUT);

    private final boolean counts;
    private final String label;

    ViolationType(boolean counts, String label) {
        this.counts = counts;
        this.label = label;
    }

    public boolean counts() { return counts; }
    public String label() { return label; }
}
