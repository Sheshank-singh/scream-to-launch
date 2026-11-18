# Scream to Launch

Scream into your microphone and fly a rocket. Louder, longer screams make more thrust. Stop, and the rocket coasts, falls, and scores your apogee — from a neighbour-alarming hop to the Kármán line, the ISS, the Moon, or Mars.

Play it: https://sheshank-singh.github.io/scream-to-launch/

## Play

Tap **Start**, allow the microphone, and scream. If the mic is blocked, hold the on-screen button or the spacebar to thrust. Loudness is measured in the browser and never recorded or uploaded. Personal bests stay on this device.

Headphones help, so the engine sound doesn't feed the microphone.

## Enable GitHub Pages

`.github/workflows/pages.yml` deploys the site on every push to `main`.

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

If Actions isn't available, deploy the branch instead:

1. **Settings → Pages**.
2. **Deploy from a branch**.
3. Branch **main**, folder **/ (root)**, then save.

The live URL is https://sheshank-singh.github.io/scream-to-launch/

## Run locally

Microphone access needs `localhost` or HTTPS.

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/

- `?sim=1` adds a volume slider (and **Yell** / **Quiet**, or hold space) so you can fly without a mic.
- `?fallback=1` skips the mic and uses hold-to-thrust.

## City leaderboard

Bests are stored in this browser. `js/leaderboard.js` is the only module that reads and writes them. A shared board can replace `noteApex`, `submitRun`, `cityBoard`, and `overview` later; the rest of the game already talks to that adapter and not to `localStorage` directly.
