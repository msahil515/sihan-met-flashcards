package com.sihan.tests;

/* Serializes recognizer activities so a late result cannot inherit a newer request ID. */
public final class VoiceRequestQueue {
    public static final int BUSY = 0;
    public static final int START = 1;
    public static final int QUEUED = 2;

    public static final class Request {
        public final String id;
        public final String language;
        public boolean cancelled;

        private Request(String id, String language) {
            this.id = id;
            this.language = language;
        }
    }

    private Request current;
    private Request queued;

    public int request(String id, String language) {
        if (current == null) {
            current = new Request(id, language);
            return START;
        }
        if (current.cancelled && queued == null) {
            queued = new Request(id, language);
            return QUEUED;
        }
        return BUSY;
    }

    public boolean cancel(String id) {
        if (queued != null && queued.id.equals(id)) {
            queued = null;
            return false;
        }
        if (current != null && current.id.equals(id) && !current.cancelled) {
            current.cancelled = true;
            return true;
        }
        return false;
    }

    public Request complete() {
        Request finished = current;
        current = queued;
        queued = null;
        return finished;
    }

    public Request failed(String id) {
        if (current == null || !current.id.equals(id)) return null;
        current = queued;
        queued = null;
        return current;
    }

    public Request current() { return current; }

    public void clear() {
        current = null;
        queued = null;
    }
}
