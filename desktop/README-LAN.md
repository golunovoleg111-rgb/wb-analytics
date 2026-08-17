# LAN operator guide

Host computer: start B-JOB -> LAN -> Start LAN server. Share the displayed URL and key with the client computer.

Client computer: open LAN -> enter host URL and key -> save connection. Use Push to send the current supported local stores to the host, or Pull to replace the client stores with the host snapshot.

Both computers must be on the same local network. Internet is not required.

Before Pull, export a JSON backup. Conflicting records are not silently merged in this stage.