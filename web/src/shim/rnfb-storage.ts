import {
	getStorage,
	ref as mRef,
	uploadBytesResumable,
	getDownloadURL as mGetDownloadURL,
	deleteObject,
	type UploadTask,
} from "firebase/storage";
import { app } from "./firebaseApp";

/*
 * Stands in for `@react-native-firebase/storage`.
 *
 * Unlike Firestore, Storage does NOT port cleanly. RNFirebase's
 * `ref.putFile(uri)` takes a native file URI — a path on the device — and there
 * is no browser equivalent: the web uploads a File or Blob object. That is why
 * UploadManagerContext is rewritten for the web (web/src/contexts/UploadContext)
 * rather than reused, and why nothing under ../../src actually imports this.
 *
 * It exists so the specifier resolves if a shared module ever pulls Storage in,
 * and so the rewrite has one obvious place to reach for the raw SDK.
 *
 * NOTE: browser uploads need CORS on the bucket, which the mobile app never
 * required. See web/cors.json.
 */

export const storage = () => getStorage(app);

function makeRef(path: string) {
	const reference = mRef(getStorage(app), path);

	return {
		fullPath: reference.fullPath,
		name: reference.name,
		_ref: reference,

		/** Web callers pass a File/Blob; the native URI form has no analogue. */
		putFile(data: File | Blob): UploadTask {
			return uploadBytesResumable(reference, data);
		},

		put(data: Blob | Uint8Array | ArrayBuffer): UploadTask {
			return uploadBytesResumable(reference, data);
		},

		getDownloadURL(): Promise<string> {
			return mGetDownloadURL(reference);
		},

		delete(): Promise<void> {
			return deleteObject(reference);
		},
	};
}

const storageShim = () => ({
	ref: makeRef,
	refFromURL: makeRef,
});

export default storageShim;
export { makeRef as ref };
