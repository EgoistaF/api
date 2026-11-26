# Self-hosting QuizMaster

On your own server the app keeps profiles in a directory on disk. There is no
storage service, no quota and no third party — a running Node process and a
folder are the whole backend.

## What you need

- A server with Docker, or with Node 22+
- A domain pointing at it, if you want HTTPS
- About 300 MB of disk for the app; profiles are roughly 60 KB each

## One secret

`AUTH_SECRET` signs session cookies and derives the paths profiles are stored
under. Generate it once and keep it:

```bash
openssl rand -hex 32
```

Changing it later signs everyone out **and makes existing profiles
unreachable**, because the paths are derived from it. Back it up with the data.

## Option A — Docker Compose

```bash
git clone <this repo> quizmaster && cd quizmaster
echo "AUTH_SECRET=$(openssl rand -hex 32)" > .env
docker compose up -d --build
curl localhost:3000/api/health
```

Expect `{"ok":true,...,"storage":"filesystem",...}`.

Profiles live in the `quizmaster-data` volume. Back it up with:

```bash
docker run --rm -v quizmaster-data:/data -v "$PWD:/out" alpine \
  tar czf /out/quizmaster-backup-$(date +%F).tar.gz -C /data .
```

Update with `git pull && docker compose up -d --build`. The volume is untouched.

## Option B — plain Node

```bash
git clone <this repo> /opt/quizmaster && cd /opt/quizmaster
npm ci
npm run build
AUTH_SECRET=... DATA_DIR=/var/lib/quizmaster PORT=3000 npm start
```

As a service, `/etc/systemd/system/quizmaster.service`:

```ini
[Unit]
Description=QuizMaster
After=network.target

[Service]
Type=simple
User=quizmaster
WorkingDirectory=/opt/quizmaster
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATA_DIR=/var/lib/quizmaster
Environment=AUTH_SECRET=replace-me
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo mkdir -p /var/lib/quizmaster && sudo chown quizmaster: /var/lib/quizmaster
sudo systemctl enable --now quizmaster
```

Back up by copying `/var/lib/quizmaster`.

## HTTPS

The app listens on plain HTTP; put nginx in front:

```nginx
server {
    server_name quiz.example.com;
    client_max_body_size 8m;   # screenshots sent to the import page

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Then `sudo certbot --nginx -d quiz.example.com`.

**HTTPS is not optional.** The session cookie is marked `Secure`, so sign-in
does not work over plain HTTP from anywhere but localhost.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `AUTH_SECRET` | — | Required. Signs sessions, derives storage paths |
| `DATA_DIR` | `./.data` | Where profiles are kept, with the filesystem driver |
| `STORAGE_DRIVER` | auto | `filesystem`, `redis` or `blob`; see below |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | — | A Redis store over HTTPS. `KV_REST_API_URL` / `KV_REST_API_TOKEN` work too |
| `BLOB_READ_WRITE_TOKEN` | — | A Vercel Blob store |
| `PORT` | `3000` | Port to listen on |
| `ANTHROPIC_API_KEY` | — | Optional. Lets everyone on this server read word lists with Claude |

`/api/health` reports which driver is active, whether it can be read, and —
when a write has just failed — the store's own words about why.

### Where profiles are kept

Three places, chosen in this order unless `STORAGE_DRIVER` names one:

1. **Redis over HTTPS** (`redis`), when `UPSTASH_REDIS_REST_URL` and its token
   are set. For a hosted instance.
2. **Vercel Blob** (`blob`), when `BLOB_READ_WRITE_TOKEN` is set.
3. **The filesystem** (`filesystem`) otherwise. For a server with a disk: no
   quota, no third party, and the store is a directory you can copy.

All three write the same bytes — gzipped JSON, one file per profile — so
moving between them is a copy, not a conversion.

**Vercel Blob runs out.** Its free plan counts every saved library as an
"advanced operation" and allows 2 000 a month; one person studying daily can
use them up, and then sign-up fails while reading keeps working. `/api/health`
shows that as `writeBlocked: true`. A free Redis store counts plain commands
and allows hundreds of thousands, which is why it is preferred when both are
configured.

On Vercel: **Storage → Create → Upstash Redis**, connect it to the project,
and it sets `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` itself.
Redeploy, then check `/api/health` says `"storage":"redis"`.

Anything that speaks the Upstash REST protocol works, self-hosted included:
point the two variables at it.

### Reading word lists with a model

Recognition runs in the browser and costs nothing. Importing a photo can also
go through Claude, which reads handwriting and wide tables the local engine
cannot — the picture is then sent to Anthropic and billed to whoever's key is
used.

Set `ANTHROPIC_API_KEY` here and the button works for everyone on the server,
at your expense — for signed-in visitors only, so a key on a public server
cannot be spent by passers-by (without `AUTH_SECRET` nobody can sign in, and
the key is open to anyone who can reach the server). Leave it unset and each person can paste their own key under
**Settings → Распознавание с ИИ**; it stays in their browser, travels with the
one request it is used for, and is never stored on the server.

## Moving your data across

Profiles are per-deployment: a new server starts with none. Carry your library
over through the app itself — **Settings → Download a copy (JSON)** on the old
one, **Upload from file** on the new one — then register there and it syncs
from that browser onwards.

## Checking it works

```bash
npm run check                                   # logic and the profile store,
                                                # no server needed
BASE=https://quiz.example.com npm run test:e2e  # the whole app, including
                                                # two devices sharing a profile
```

The sync suite skips itself when the profile store is unavailable, so a green
run that mentions it means profiles genuinely work.
