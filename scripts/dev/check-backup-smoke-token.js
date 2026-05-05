const accessToken = process.env.BACKUP_SMOKE_ACCESS_TOKEN?.trim();

if (!accessToken) {
  console.error(
    "BACKUP_SMOKE_ACCESS_TOKEN is required. Sign in locally with Logto and provide a Worker API access token for the configured API resource."
  );
  process.exit(1);
}
