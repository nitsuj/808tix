import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

type CameraTestStatus = 'idle' | 'requesting' | 'streaming' | 'error';

export default function CameraTestScreen() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    let stream: MediaStream | null = null;

    const statusEl = document.createElement('p');
    const errorEl = document.createElement('p');
    const startButton = document.createElement('button');
    const stopButton = document.createElement('button');
    const videoHost = document.createElement('div');
    const video = document.createElement('video');

    statusEl.textContent = 'Status: idle';
    statusEl.style.color = '#ffffff';
    statusEl.style.fontFamily = 'monospace';
    statusEl.style.fontSize = '16px';
    statusEl.style.fontWeight = '700';
    statusEl.style.margin = '0 0 8px';
    errorEl.textContent = '';
    errorEl.style.color = '#ff6b6b';
    errorEl.style.fontFamily = 'monospace';
    errorEl.style.margin = '8px 0';

    startButton.type = 'button';
    startButton.textContent = 'Start Camera';
    stopButton.type = 'button';
    stopButton.textContent = 'Stop Camera';
    stopButton.disabled = true;

    startButton.style.marginRight = '8px';
    startButton.style.padding = '8px 12px';
    startButton.style.fontSize = '16px';
    stopButton.style.padding = '8px 12px';
    stopButton.style.fontSize = '16px';

    videoHost.style.marginTop = '16px';

    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.style.width = '320px';
    video.style.height = '240px';
    video.style.border = '4px solid lime';
    video.style.backgroundColor = '#000000';
    video.style.display = 'block';

    const setStatus = (nextStatus: CameraTestStatus, errorMessage = '') => {
      statusEl.textContent = `Status: ${nextStatus}`;
      errorEl.textContent = errorMessage ? `Error: ${errorMessage}` : '';
      startButton.disabled = nextStatus === 'requesting' || nextStatus === 'streaming';
      stopButton.disabled = nextStatus !== 'streaming';
    };

    const stopCamera = () => {
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        stream = null;
      }

      video.srcObject = null;
      setStatus('idle');
    };

    const onStartClick = () => {
      void (async () => {
        stopCamera();
        setStatus('requesting');

        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          setStatus('error', 'getUserMedia is not available in this browser.');
          return;
        }

        if (typeof window !== 'undefined' && !window.isSecureContext) {
          setStatus('error', 'Camera requires HTTPS or localhost.');
          return;
        }

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });

          video.srcObject = stream;
          await video.play();
          setStatus('streaming');
        } catch (error) {
          stopCamera();

          const message =
            error instanceof Error ? error.message : 'Unknown getUserMedia failure.';
          const name = error instanceof DOMException ? error.name : '';

          setStatus('error', name ? `${name}: ${message}` : message);
        }
      })();
    };

    const onStopClick = () => {
      stopCamera();
    };

    startButton.addEventListener('click', onStartClick);
    stopButton.addEventListener('click', onStopClick);

    videoHost.appendChild(video);

    host.appendChild(statusEl);
    host.appendChild(errorEl);
    host.appendChild(startButton);
    host.appendChild(stopButton);
    host.appendChild(videoHost);

    return () => {
      startButton.removeEventListener('click', onStartClick);
      stopButton.removeEventListener('click', onStopClick);
      stopCamera();
      host.replaceChildren();
    };
  }, []);

  const assignHostRef = (node: unknown) => {
    hostRef.current = (node as HTMLDivElement | null) ?? null;
  };

  return (
    <View style={styles.page}>
      <View ref={assignHostRef} style={styles.host} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#111111',
    flex: 1,
    minHeight: '100dvh',
    padding: 16,
  },
  host: {
    flex: 1,
    width: '100%',
  },
});
