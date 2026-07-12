package br.com.boxsys.paineltv;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

// Painel de TV: sempre em tela cheia, sem barra de status/navegação, tela nunca
// apaga (mantém ligada o dia inteiro no balcão/cozinha).
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUi();
        allowAutoplayWithoutGesture();
    }

    // Sem isso, o WebView bloqueia qualquer áudio/voz (som de "pedido pronto",
    // anúncio por voz) até o usuário tocar a tela pelo menos uma vez — mas este
    // app nunca recebe toque nenhum (fica sozinho numa TV, controlado por
    // controle remoto que nem é usado nessa tela), então o som nunca tocaria.
    private void allowAutoplayWithoutGesture() {
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    private void hideSystemUi() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }
}
