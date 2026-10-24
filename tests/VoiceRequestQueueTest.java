public final class VoiceRequestQueueTest {
    private static void check(boolean ok, String message) {
        if (!ok) throw new AssertionError(message);
    }

    private static void testsApp() {
        com.sihan.tests.VoiceRequestQueue q = new com.sihan.tests.VoiceRequestQueue();
        check(q.request("A", "en-US") == com.sihan.tests.VoiceRequestQueue.START, "A starts");
        check(q.cancel("A"), "A remains correlated while cancellation drains");
        check(q.request("B", "en-US") == com.sihan.tests.VoiceRequestQueue.QUEUED, "B waits for A result");
        com.sihan.tests.VoiceRequestQueue.Request a = q.complete();
        check("A".equals(a.id) && a.cancelled, "late result still belongs to cancelled A");
        check("B".equals(q.current().id), "B starts only after A drains");
        com.sihan.tests.VoiceRequestQueue.Request b = q.complete();
        check("B".equals(b.id) && !b.cancelled && q.current() == null, "B completes independently");
    }

    private static void nameLockApp() {
        com.sihan.namelock.VoiceRequestQueue q = new com.sihan.namelock.VoiceRequestQueue();
        check(q.request("A", "en-US") == com.sihan.namelock.VoiceRequestQueue.START, "A starts");
        check(q.cancel("A"), "A remains correlated while cancellation drains");
        check(q.request("B", "en-US") == com.sihan.namelock.VoiceRequestQueue.QUEUED, "B waits for A result");
        com.sihan.namelock.VoiceRequestQueue.Request a = q.complete();
        check("A".equals(a.id) && a.cancelled, "late result still belongs to cancelled A");
        check("B".equals(q.current().id), "B starts only after A drains");
        com.sihan.namelock.VoiceRequestQueue.Request b = q.complete();
        check("B".equals(b.id) && !b.cancelled && q.current() == null, "B completes independently");
    }

    public static void main(String[] args) {
        testsApp();
        nameLockApp();
        System.out.println("native voice request queue tests passed");
    }
}
