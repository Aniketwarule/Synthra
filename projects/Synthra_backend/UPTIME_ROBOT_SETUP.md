# UptimeRobot Setup for Render

Use this if your Render web service sleeps when idle.

## Endpoint to monitor

Use either endpoint:
- https://<your-render-service>.onrender.com/healthz
- https://<your-render-service>.onrender.com/api/healthz

Both return JSON like:

{
  "ok": true,
  "status": "ok",
  "uptimeSeconds": 123,
  "timestamp": "2026-04-16T00:00:00.000Z"
}

## UptimeRobot configuration

1. Create a monitor in UptimeRobot.
2. Monitor type: HTTP(s)
3. URL: your Render health URL from above.
4. Monitoring interval: 5 minutes.
5. Timeout: 30 seconds.
6. Optional: enable alerts for non-200 responses.

## Notes

- This keeps periodic traffic hitting your Render service.
- If your service is redeploying or cold starting, a few checks can fail briefly.
