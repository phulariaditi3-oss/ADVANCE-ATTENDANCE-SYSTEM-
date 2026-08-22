import { useEffect, useRef, useState, useCallback } from 'react';
import { loadFaceModels, getFaceDescriptor } from '../lib/faceRecognition';
import { Camera, Loader2, ScanFace } from 'lucide-react';

/**
 * Camera widget that loads the face-recognition models, streams the user's
 * front camera, and lets them capture a single face descriptor.
 *
 * Props:
 *  - onCapture(descriptor: number[]) — called once a face is confidently detected
 *  - busy — disables the capture button while a parent action (e.g. an RPC call) is in flight
 *  - instruction — short helper text shown under the camera
 */
export default function FaceCapture({ onCapture, busy = false, instruction }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [noFaceHint, setNoFaceHint] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadFaceModels()
      .then(() => { if (!cancelled) setModelsReady(true); })
      .catch(() => { if (!cancelled) setError('Could not load face recognition models. Check your connection and reload.'); });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!modelsReady) return;
    let cancelled = false;

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      })
      .catch(() => {
        if (!cancelled) setError('Camera permission is required for face verification.');
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [modelsReady]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || capturing || busy) return;
    setCapturing(true);
    setNoFaceHint(false);
    try {
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (!descriptor) {
        setNoFaceHint(true);
        return;
      }
      onCapture(descriptor);
    } catch (err) {
      setError('Face detection failed. Please try again in good lighting.');
    } finally {
      setCapturing(false);
    }
  }, [busy, capturing, onCapture]);

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="relative w-64 h-64 rounded-2xl overflow-hidden bg-surface-900 border-2 border-surface-200 shadow-inner">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover -scale-x-100"
        />
        {(!modelsReady || !cameraReady) && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-900/90 text-white gap-2">
            <Loader2 size={26} className="animate-spin" />
            <p className="text-xs font-bold">{!modelsReady ? 'Loading face model...' : 'Starting camera...'}</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-900/95 text-center px-4">
            <Camera size={26} className="text-surface-400 mb-2" />
            <p className="text-xs font-bold text-white">{error}</p>
          </div>
        )}
        <div className="absolute inset-6 pointer-events-none border-2 border-dashed border-primary-400/70 rounded-full" />
      </div>

      {instruction && <p className="text-xs font-bold text-surface-500 text-center max-w-xs">{instruction}</p>}
      {noFaceHint && (
        <p className="text-xs font-bold text-danger-600 text-center">No face detected clearly. Face the camera in good lighting and try again.</p>
      )}

      <button
        type="button"
        onClick={handleCapture}
        disabled={!modelsReady || !cameraReady || !!error || capturing || busy}
        className="btn-primary justify-center px-6 py-2.5 disabled:opacity-60"
      >
        {capturing || busy ? <Loader2 size={16} className="animate-spin" /> : <ScanFace size={16} />}
        {capturing ? 'Detecting Face...' : busy ? 'Verifying...' : 'Capture Face'}
      </button>
    </div>
  );
}
