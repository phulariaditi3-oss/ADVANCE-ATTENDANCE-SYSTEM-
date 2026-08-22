import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';
let modelsLoadedPromise = null;

/**
 * Load the (small) face-api.js models once. Safe to call repeatedly.
 * - tinyFaceDetector: fast face detection
 * - faceLandmark68Net: locates facial landmarks (needed for alignment)
 * - faceRecognitionNet: produces the 128-length embedding used for matching
 */
export function loadFaceModels() {
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
  }
  return modelsLoadedPromise;
}

/**
 * Detect exactly one face in a video/image element and return its
 * 128-length embedding (descriptor) as a plain JS array, or null if no
 * single face was confidently found.
 */
export async function getFaceDescriptor(mediaElement) {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

  const detection = await faceapi
    .detectSingleFace(mediaElement, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection || !detection.descriptor) return null;
  return Array.from(detection.descriptor);
}

/**
 * Euclidean distance between two descriptors (lower = more similar).
 * Kept here for optional client-side sanity checks; the authoritative
 * match decision always happens server-side in the verify/mark RPCs so a
 * tampered client cannot force a match.
 */
export function descriptorDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

export const FACE_MATCH_THRESHOLD = 0.5;
