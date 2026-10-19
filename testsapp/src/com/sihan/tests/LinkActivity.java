package com.sihan.tests;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/* Receives the sync code from the sister app. Exported, but guarded by the
   signature-level com.sihan.permission.SYNC_LINK permission, so only apps signed
   with the same key can start it. Hands the code to MainActivity in-process. */
public class LinkActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        MainActivity.handoff = MainActivity.cleanCode(getIntent().getStringExtra("sihan_sync"));
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(i);
        finish();
    }
}
