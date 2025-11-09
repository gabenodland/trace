import { CaptureForm } from "../modules/entries/components/CaptureForm";

export function CapturePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Capture</h1>
      <p className="text-gray-600 mb-8">
        Quick entry for thoughts, ideas, and tasks. Use #tags and @mentions to organize.
      </p>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <CaptureForm />
      </div>
    </div>
  );
}
