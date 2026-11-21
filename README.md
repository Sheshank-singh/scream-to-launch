# Scream to Launch

Scream into your microphone and fly a rocket. Louder, longer screams make more thrust. Stop, and the rocket coasts, falls, and scores your apogee — from a neighbour-alarming hop to the Kármán line, the ISS, the Moon, or Mars.

Play it: https://sheshank-singh.github.io/scream-to-launch/

## Play

Tap **Start** and stay quiet for a second and a half while the pad measures the room. The rocket stays put until you are about 9 dB louder than that floor, and also above roughly −36 dBFS, so a normal scream counts and room noise does not. Stop to breathe and it drifts down; scream again to climb. The score is your highest point. The run ends on the pad, after about 9 seconds of quiet once you have left the ground, or when you tap **Finish**. Pluto still takes several minutes of screaming. If the mic is blocked, hold the on-screen button or the spacebar. Nothing is recorded or uploaded. Personal bests stay on this device.

Headphones help, so the engine sound doesn't feed the microphone.

## Enable GitHub Pages

`.github/workflows/pages.yml` deploys the site on every push to `main`. GitHub will not publish until Pages is turned on once. The token that pushes this repo cannot flip that setting.

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. If a workflow run already failed with "Pages site not found", open the **Actions** tab and re-run **Deploy GitHub Pages**.

If GitHub Actions is not offered as a source, use a branch deploy instead:

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

## Global leaderboard

Submitted scores go to a public [npoint.io](https://www.npoint.io) document (`js/board-config.js`). There is no secret key. The document id is public, so the list can be read from GitHub Pages, and a determined person could overwrite it. The game still drops scores that are higher than a full scream could reach in the recorded flight time, rejects short or rude nicknames, and submits each run only once.

Personal bests stay in this browser. The global board is the **Leaderboard** button.

## Country leaderboard

Bests are stored in this browser, one per country. `js/leaderboard.js` is the only module that reads and writes them. A shared board can replace `noteApex`, `submitRun`, `countryBoard`, and `overview` later; the rest of the game already talks to that adapter and not to `localStorage` directly. Older saves that used a city name are kept and shown as that place.
