/* SecureText walkthrough demo.
   Simplified demo for learning, not the real tool. It uses the browser's
   built-in Web Crypto API: ECDH (P-256) to agree on a shared secret, HKDF to
   turn that secret into a key, and AES-GCM to encrypt the message. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var msgInput = $("st-message");
  var nextBtn = $("st-next");
  var resetBtn = $("st-reset");
  var tamperBox = $("st-tamper");
  var stepText = $("st-step-text");
  var stepList = $("st-steps");
  var serverList = $("st-server-list");
  if (!nextBtn) return;

  var subtle = window.crypto && window.crypto.subtle;
  var enc = new TextEncoder();
  var dec = new TextDecoder();

  var STEPS = [
    {
      title: "Swap public keys",
      text: "Alice and Bob each make a key pair: a private key that never leaves their device, and a public key that is safe to share. They send each other their public keys through the server."
    },
    {
      title: "Make the same secret",
      text: "Alice mixes her private key with Bob's public key. Bob mixes his private key with Alice's public key. Thanks to the math behind ECDH, they both get the exact same secret key, and that key was never sent anywhere."
    },
    {
      title: "Encrypt",
      text: "Alice locks her message with the shared key using AES-GCM. The result looks like random letters. She also picks a random number (the IV) that makes every encrypted message different, even if the text is the same."
    },
    {
      title: "Server forwards",
      text: "The server passes the scrambled message and the IV to Bob. It can see them, but without the shared key it can't read the message."
    },
    {
      title: "Bob decrypts",
      text: "Bob unlocks the message with his copy of the shared key. AES-GCM also checks that nothing was changed on the way. If even one bit was changed, Bob's app rejects the message."
    }
  ];

  var state;

  /* ---------- Formatting bytes and updating the three panels ---------- */
  function hex(buf, max) {
    var bytes = new Uint8Array(buf);
    var out = "";
    for (var i = 0; i < bytes.length && i < max; i++) out += bytes[i].toString(16).padStart(2, "0");
    return out + (bytes.length > max ? "…" : "");
  }

  function b64(buf) {
    var bytes = new Uint8Array(buf);
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function setText(id, text, cls) {
    var el = $(id);
    el.textContent = text;
    el.className = cls || "";
  }

  function addServerItem(label, value) {
    var li = document.createElement("li");
    var strong = document.createElement("span");
    strong.className = "muted";
    strong.textContent = label + ": ";
    var v = document.createElement("span");
    v.className = "scrambled";
    v.textContent = value;
    li.appendChild(strong);
    li.appendChild(v);
    serverList.appendChild(li);
  }

  function renderSteps() {
    stepList.textContent = "";
    STEPS.forEach(function (s, i) {
      var li = document.createElement("li");
      li.textContent = (i + 1) + ". " + s.title;
      if (i < state.step) li.className = "done";
      if (i === state.step - 1) li.className = "current";
      if (i === state.step - 1) li.setAttribute("aria-current", "step");
      stepList.appendChild(li);
    });
  }

  function reset() {
    state = { step: 0 };
    msgInput.disabled = false;
    tamperBox.disabled = false;
    tamperBox.checked = false;
    nextBtn.disabled = !subtle;
    nextBtn.textContent = "Start";
    serverList.textContent = "";
    var li = document.createElement("li");
    li.className = "muted";
    li.textContent = "Nothing yet.";
    serverList.appendChild(li);
    ["st-a-pub", "st-b-pub", "st-a-key", "st-b-key", "st-a-cipher", "st-b-plain"].forEach(function (id) {
      setText(id, "—", "muted");
    });
    setText("st-a-plain", msgInput.value || "—", "plain");
    if (!subtle) {
      stepText.textContent = "Your browser doesn't allow the Web Crypto API on this page (it needs HTTPS or localhost), so this demo can't run here.";
    } else {
      stepText.textContent = "Type a message for Alice to send, then press Start.";
    }
    renderSteps();
  }

  /* ---------- The five steps. Each uses the browser's real Web Crypto API. ---------- */
  async function step1() {
    var params = { name: "ECDH", namedCurve: "P-256" };
    state.alice = await subtle.generateKey(params, false, ["deriveBits"]);
    state.bob = await subtle.generateKey(params, false, ["deriveBits"]);
    var aPub = await subtle.exportKey("raw", state.alice.publicKey);
    var bPub = await subtle.exportKey("raw", state.bob.publicKey);
    setText("st-a-pub", hex(aPub, 12));
    setText("st-b-pub", hex(bPub, 12));
    serverList.textContent = "";
    addServerItem("Alice's public key", hex(aPub, 12));
    addServerItem("Bob's public key", hex(bPub, 12));
  }

  async function sharedKey(myPrivate, theirPublic) {
    var bits = await subtle.deriveBits({ name: "ECDH", public: theirPublic }, myPrivate, 256);
    var base = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
    return subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(16), info: enc.encode("securetext demo") },
      base,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async function step2() {
    state.aKey = await sharedKey(state.alice.privateKey, state.bob.publicKey);
    state.bKey = await sharedKey(state.bob.privateKey, state.alice.publicKey);
    var aRaw = await subtle.exportKey("raw", state.aKey);
    var bRaw = await subtle.exportKey("raw", state.bKey);
    setText("st-a-key", hex(aRaw, 10), "plain");
    setText("st-b-key", hex(bRaw, 10), "plain");
  }

  async function step3() {
    state.iv = window.crypto.getRandomValues(new Uint8Array(12));
    state.cipher = await subtle.encrypt({ name: "AES-GCM", iv: state.iv }, state.aKey, enc.encode(state.message));
    setText("st-a-cipher", b64(state.cipher), "scrambled");
  }

  function step4() {
    var forwarded = new Uint8Array(state.cipher.slice(0));
    if (tamperBox.checked) forwarded[0] ^= 1; /* flip one bit */
    state.forwarded = forwarded.buffer;
    tamperBox.disabled = true;
    addServerItem("IV (random, not secret)", hex(state.iv, 12));
    addServerItem("Scrambled message", b64(state.forwarded));
  }

  async function step5() {
    try {
      var plain = await subtle.decrypt({ name: "AES-GCM", iv: state.iv }, state.bKey, state.forwarded);
      setText("st-b-plain", dec.decode(plain), "plain");
    } catch (e) {
      setText("st-b-plain", "Rejected: the message was changed on the way, so the check failed.", "scrambled");
    }
  }

  var ACTIONS = [step1, step2, step3, step4, step5];

  async function next() {
    if (state.step === 0) {
      state.message = msgInput.value.trim() || "Hi Bob!";
      msgInput.value = state.message;
      msgInput.disabled = true;
      setText("st-a-plain", state.message, "plain");
    }
    if (state.step >= STEPS.length) return;
    nextBtn.disabled = true;
    try {
      await ACTIONS[state.step]();
    } catch (e) {
      stepText.textContent = "Something went wrong in the demo: " + e.message;
      return;
    }
    state.step++;
    var s = STEPS[state.step - 1];
    stepText.textContent = "Step " + state.step + " of " + STEPS.length + " — " + s.title + ": " + s.text;
    renderSteps();
    if (state.step < STEPS.length) {
      nextBtn.disabled = false;
      nextBtn.textContent = "Next step";
    } else {
      nextBtn.textContent = "Done";
    }
  }

  msgInput.addEventListener("input", function () {
    if (state.step === 0) setText("st-a-plain", msgInput.value || "—", "plain");
  });
  nextBtn.addEventListener("click", next);
  resetBtn.addEventListener("click", reset);
  reset();
})();
