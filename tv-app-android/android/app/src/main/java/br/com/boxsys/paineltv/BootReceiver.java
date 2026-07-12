package br.com.boxsys.paineltv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// Dispara a MainActivity assim que o sistema termina de ligar (ou "quick boot" da
// Amazon no Fire TV), sem precisar de nenhum toque no controle remoto.
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        context.startActivity(launchIntent);
    }
}
