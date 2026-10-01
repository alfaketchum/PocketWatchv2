# PocketWatch VM recovery

The production app runs as `pocketwatch.service` on port 8000; PostgreSQL runs
in Docker. The web terminal is `pocketwatch-terminal.service`.

## Memory exhaustion (October 1, 2026)

The 8 GB VM became unresponsive while it had **no swap**. The previous boot's
kernel journal recorded page-allocation failures at 17:15 and 17:18 UTC, and
systemd-journald repeatedly reported memory pressure through 18:03 UTC.
The PocketWatch cron scheduler missed a run at 17:58 UTC. This is evidence of
VM-wide memory exhaustion, not proof that the production app caused it:
development servers and TypeScript checks had also consumed several GB earlier
that day.

On October 1, a 2 GiB `/swapfile` was activated and added to `/etc/fstab`.
It is an emergency buffer, not permission to run unlimited builds concurrently.
Keep one dev preview at a time; don't run builds and type checks alongside
multiple previews. Stop leftover previews after testing.

## Checks after an outage

```sh
free -h
swapon --show
df -h /
ps -eo pid,ppid,rss,cmd --sort=-rss | head -25
systemctl status pocketwatch docker --no-pager
curl -I --max-time 15 http://localhost:8000/
journalctl -b -1 -k --no-pager | grep -Ei 'allocation failure|out of memory|killed process'
journalctl -u pocketwatch -n 100 --no-pager
```

If swap is absent after a reboot, check `/etc/fstab` for
`/swapfile none swap sw 0 0` and run `sudo swapon /swapfile`. If memory
pressure recurs, identify and stop the biggest unnecessary process rather
than rebooting immediately. Check available disk space before increasing swap.
