import React from "react";
import logo from "../../assets/icon.png";

export default function Onboarding({ onFinish }) {
  return (
    <div className="iris-onboarding">
      <div className="iris-onboarding-card">
        <div className="iris-onboarding-brand">
          <img src={logo} alt="" />
          <div>
            <p className="eyebrow">Welcome</p>
            <h1>Set up Iris Flow on this Mac</h1>
          </div>
        </div>
        <p>
          Iris Flow runs locally. Your chats, files, and keys stay on this computer.
          Speech and AI still use the API keys you paste below.
        </p>
        <ol>
          <li>
            Grant <strong>Accessibility</strong> and <strong>Microphone</strong> when macOS asks.
            Accessibility lets Iris Flow listen for Left-Ctrl and paste dictation.
          </li>
          <li>
            Open <strong>Keys</strong> and paste a <strong>Deepgram</strong> key. That is enough for
            dictation (Wispr-style speech to text).
          </li>
          <li>
            Keep AI mode off to insert whatever you say at the cursor. Turn AI mode on, add
            Cerebras / OpenAI / Claude, then hold Left-Ctrl to ask about selected text or your files.
          </li>
          <li>
            Optional: add a <strong>Google AI</strong> key and drop documents on Resources. In AI
            mode, Iris Flow can search those files when you hold Ctrl.
          </li>
          <li>
            To use Iris Flow anytime without Terminal, quit and from <code>Irisflow</code> run{" "}
            <code>npm run install:mac</code>. That puts Irisflow in Applications. After that, open it
            from Spotlight or the Dock like any other app.
          </li>
        </ol>
        <button className="iris-signin-button" type="button" onClick={onFinish}>
          Continue
        </button>
      </div>
    </div>
  );
}
