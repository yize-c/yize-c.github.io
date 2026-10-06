/* SecureText walkthrough demo.
   Simplified demo for learning, not the real tool. It uses the browser's
   built-in Web Crypto API: ECDH (P-256) to agree on a shared secret, HKDF to
   turn that secret into a key, and AES-GCM to encrypt the message. */
(function () {
  "use strict";

  var el = window.YC.el;
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

  /* ---------- Formatting bytes ---------- */
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

  /* ECDH secret → HKDF → an AES-GCM key. Both sides run this and get the same key. */
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

  class SecureTextDemo {
    constructor() {
      var $ = function (id) { return document.getElementById(id); };
      this.msgInput = $("st-message");
      this.nextBtn = $("st-next");
      this.tamperBox = $("st-tamper");
      this.stepText = $("st-step-text");
      this.stepList = $("st-steps");
      this.serverList = $("st-server-list");
      this.actions = [this.swapKeys, this.makeSecret, this.encrypt, this.forward, this.decrypt];
      var self = this;
      this.msgInput.addEventListener("input", function () {
        if (self.state.step === 0) self.setText("st-a-plain", self.msgInput.value || "—", "plain");
      });
      this.nextBtn.addEventListener("click", function () { self.next(); });
      $("st-reset").addEventListener("click", function () { self.reset(); });
      this.reset();
    }

    /* ---------- Updating the three panels ---------- */
    setText(id, text, cls) {
      var node = document.getElementById(id);
      node.textContent = text;
      node.className = cls || "";
    }

    addServerItem(label, value) {
      this.serverList.appendChild(el("li", null, [
        el("span", { class: "muted", text: label + ": " }),
        el("span", { class: "scrambled", text: value })
      ]));
    }

    renderSteps() {
      var list = this.stepList, step = this.state.step;
      list.textContent = "";
      STEPS.forEach(function (s, i) {
        var current = i === step - 1;
        list.appendChild(el("li", {
          class: current ? "current" : i < step ? "done" : null,
          "aria-current": current ? "step" : null,
          text: (i + 1) + ". " + s.title
        }));
      });
    }

    reset() {
      var self = this;
      this.state = { step: 0 };
      this.msgInput.disabled = false;
      this.tamperBox.disabled = false;
      this.tamperBox.checked = false;
      this.nextBtn.disabled = !subtle;
      this.nextBtn.textContent = "Start";
      this.serverList.textContent = "";
      this.serverList.appendChild(el("li", { class: "muted", text: "Nothing yet." }));
      ["st-a-pub", "st-b-pub", "st-a-key", "st-b-key", "st-a-cipher", "st-b-plain"].forEach(function (id) {
        self.setText(id, "—", "muted");
      });
      this.setText("st-a-plain", this.msgInput.value || "—", "plain");
      this.stepText.textContent = subtle
        ? "Type a message for Alice to send, then press Start."
        : "Your browser doesn't allow the Web Crypto API on this page (it needs HTTPS or localhost), so this demo can't run here.";
      this.renderSteps();
    }

    /* ---------- The five steps. Each uses the browser's real Web Crypto API. ---------- */
    async swapKeys() {
      var st = this.state;
      var params = { name: "ECDH", namedCurve: "P-256" };
      st.alice = await subtle.generateKey(params, false, ["deriveBits"]);
      st.bob = await subtle.generateKey(params, false, ["deriveBits"]);
      var aPub = await subtle.exportKey("raw", st.alice.publicKey);
      var bPub = await subtle.exportKey("raw", st.bob.publicKey);
      this.setText("st-a-pub", hex(aPub, 12));
      this.setText("st-b-pub", hex(bPub, 12));
      this.serverList.textContent = "";
      this.addServerItem("Alice's public key", hex(aPub, 12));
      this.addServerItem("Bob's public key", hex(bPub, 12));
    }

    async makeSecret() {
      var st = this.state;
      st.aKey = await sharedKey(st.alice.privateKey, st.bob.publicKey);
      st.bKey = await sharedKey(st.bob.privateKey, st.alice.publicKey);
      this.setText("st-a-key", hex(await subtle.exportKey("raw", st.aKey), 10), "plain");
      this.setText("st-b-key", hex(await subtle.exportKey("raw", st.bKey), 10), "plain");
    }

    async encrypt() {
      var st = this.state;
      st.iv = window.crypto.getRandomValues(new Uint8Array(12));
      st.cipher = await subtle.encrypt({ name: "AES-GCM", iv: st.iv }, st.aKey, enc.encode(st.message));
      this.setText("st-a-cipher", b64(st.cipher), "scrambled");
    }

    forward() {
      var st = this.state;
      var forwarded = new Uint8Array(st.cipher.slice(0));
      if (this.tamperBox.checked) forwarded[0] ^= 1; /* flip one bit */
      st.forwarded = forwarded.buffer;
      this.tamperBox.disabled = true;
      this.addServerItem("IV (random, not secret)", hex(st.iv, 12));
      this.addServerItem("Scrambled message", b64(st.forwarded));
    }

    async decrypt() {
      var st = this.state;
      try {
        var plain = await subtle.decrypt({ name: "AES-GCM", iv: st.iv }, st.bKey, st.forwarded);
        this.setText("st-b-plain", dec.decode(plain), "plain");
      } catch (e) {
        this.setText("st-b-plain", "Rejected: the message was changed on the way, so the check failed.", "scrambled");
      }
    }

    /* Run the next step, then describe it. */
    async next() {
      var st = this.state;
      if (st.step === 0) {
        st.message = this.msgInput.value.trim() || "Hi Bob!";
        this.msgInput.value = st.message;
        this.msgInput.disabled = true;
        this.setText("st-a-plain", st.message, "plain");
      }
      if (st.step >= STEPS.length) return;
      this.nextBtn.disabled = true;
      try {
        await this.actions[st.step].call(this);
      } catch (e) {
        this.stepText.textContent = "Something went wrong in the demo: " + e.message;
        return;
      }
      st.step++;
      var s = STEPS[st.step - 1];
      this.stepText.textContent = "Step " + st.step + " of " + STEPS.length + " — " + s.title + ": " + s.text;
      this.renderSteps();
      if (st.step < STEPS.length) {
        this.nextBtn.disabled = false;
        this.nextBtn.textContent = "Next step";
      } else {
        this.nextBtn.textContent = "Done";
      }
    }
  }

  if (document.getElementById("st-next")) new SecureTextDemo();
})();
