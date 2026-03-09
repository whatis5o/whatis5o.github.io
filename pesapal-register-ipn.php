<?php
/**
 * AfriStay — Pesapal IPN Registration Tool
 * Upload to public_html on AOS hosting.
 * Access at: https://afristay.rw/pesapal-register-ipn.php
 *
 * This MUST be PHP (not HTML) because Pesapal blocks direct
 * browser fetch calls (CORS). PHP runs server-side so no CORS issue.
 */

// ── Config ────────────────────────────────────────────────────────
$IPN_URL   = "https://afristay.rw/pesapal-ipn.php";
$SANDBOX   = true;  // change to false when going live
$BASE      = $SANDBOX
    ? "https://cybqa.pesapal.com/pesapalv3"
    : "https://pay.pesapal.com/v3";

// ── Log helper ────────────────────────────────────────────────────
$logs = [];
function addLog($msg, $type = "info") {
    global $logs;
    $logs[] = ["type" => $type, "msg" => $msg, "time" => date("H:i:s")];
}

// ── cURL helper ───────────────────────────────────────────────────
function pesapalPost($url, $payload, $token = null) {
    $ch = curl_init($url);
    $headers = [
        "Content-Type: application/json",
        "Accept: application/json",
    ];
    if ($token) {
        $headers[] = "Authorization: Bearer $token";
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $raw      = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    return [
        "raw"      => $raw,
        "code"     => $httpCode,
        "curl_err" => $curlErr,
        "data"     => $raw ? json_decode($raw, true) : null,
    ];
}

// ── Handle form submission ────────────────────────────────────────
$result   = null;
$ipn_id   = null;
$error    = null;

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $key    = trim($_POST["key"]    ?? "");
    $secret = trim($_POST["secret"] ?? "");
    $env    = $_POST["env"] === "live" ? "live" : "sandbox";
    $base   = $env === "live"
        ? "https://pay.pesapal.com/v3"
        : "https://cybqa.pesapal.com/pesapalv3";

    addLog("Environment: $env → $base");
    addLog("IPN URL: $IPN_URL");

    if (!$key || !$secret) {
        $error = "Consumer Key and Consumer Secret are required.";
        addLog("❌ Missing credentials", "error");
    } else {
        // ── Step 1: Auth token ────────────────────────────────────
        addLog("Step 1: Requesting auth token...");
        $auth = pesapalPost("$base/api/Auth/RequestToken", [
            "consumer_key"    => $key,
            "consumer_secret" => $secret,
        ]);

        addLog("HTTP $auth[code] ← Auth endpoint");
        addLog("Raw response: " . substr($auth["raw"] ?? "(empty)", 0, 300));

        if ($auth["curl_err"]) {
            $error = "cURL error: " . $auth["curl_err"];
            addLog("❌ cURL error: " . $auth["curl_err"], "error");
        } elseif ($auth["code"] !== 200 || empty($auth["data"]["token"])) {
            $error = "Auth failed (HTTP $auth[code]): " . ($auth["raw"] ?? "no response");
            addLog("❌ Auth failed — " . ($auth["raw"] ?? "empty body"), "error");
        } else {
            $token = $auth["data"]["token"];
            addLog("✅ Auth token received (" . substr($token, 0, 20) . "...)", "ok");

            // ── Step 2: Register IPN ──────────────────────────────
            addLog("Step 2: Registering IPN URL...");
            $ipn = pesapalPost("$base/api/URLSetup/RegisterIPN", [
                "url"                    => $IPN_URL,
                "ipn_notification_type"  => "POST",
            ], $token);

            addLog("HTTP $ipn[code] ← IPN endpoint");
            addLog("Raw response: " . substr($ipn["raw"] ?? "(empty)", 0, 500));

            if ($ipn["curl_err"]) {
                $error = "cURL error on IPN: " . $ipn["curl_err"];
                addLog("❌ cURL error: " . $ipn["curl_err"], "error");
            } elseif ($ipn["code"] !== 200) {
                $error = "IPN registration failed (HTTP $ipn[code]): " . ($ipn["raw"] ?? "no response");
                addLog("❌ IPN failed — " . ($ipn["raw"] ?? "empty body"), "error");
            } else {
                // Pesapal might return different field names
                $d = $ipn["data"] ?? [];
                $ipn_id = $d["ipn_id"] ?? $d["id"] ?? $d["IpnId"] ?? $d["ipnId"] ?? null;

                if ($ipn_id) {
                    addLog("✅ IPN registered! ID: $ipn_id", "ok");
                    $result = $ipn_id;
                } else {
                    // Show full response so we can debug
                    $error = "No IPN ID in response. Full response: " . json_encode($d, JSON_PRETTY_PRINT);
                    addLog("❌ No IPN ID found. Full data: " . json_encode($d), "error");
                }
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pesapal IPN Registration — AfriStay</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0 }
body { font-family: system-ui, sans-serif; background: #f2f0ec; min-height: 100vh;
        display: flex; align-items: center; justify-content: center; padding: 20px }
    .card { background: #fff; border-radius: 20px; padding: 32px; max-width: 560px;
            width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,.09) }
    h1 { font-size: 20px; font-weight: 800; color: #1a1a1a; margin-bottom: 6px }
    .sub { font-size: 13px; color: #aaa; margin-bottom: 24px; line-height: 1.6 }
    label { display: block; font-size: 11px; font-weight: 700; color: #bbb;
            text-transform: uppercase; letter-spacing: .5px; margin-bottom: 5px }
    input, select { width: 100%; padding: 11px 14px; border: 1.5px solid #e8e8e8;
                    border-radius: 10px; font-size: 14px; font-family: inherit;
                    outline: none; margin-bottom: 16px; background: #fff }
    input:focus, select:focus { border-color: #EB6753 }
    .btn { width: 100%; padding: 14px; border: none; border-radius: 11px; font-size: 15px;
        font-weight: 800; cursor: pointer; font-family: inherit;
        background: #EB6753; color: #fff }
    .btn:hover { background: #d04e3b }

    .success { background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px;
            padding: 20px; margin-top: 20px; color: #166534 }
    .success h2 { font-size: 17px; margin-bottom: 10px }
    .ipn-box { font-size: 16px; font-weight: 800; background: #fff; border: 1.5px solid #bbf7d0;
            border-radius: 8px; padding: 10px 14px; margin: 10px 0; word-break: break-all;
            cursor: pointer; font-family: monospace }
    .ipn-box:hover { background: #f0fdf4 }

    .error-box { background: #fff0f0; border: 1.5px solid #fca5a5; border-radius: 12px;
                padding: 18px; margin-top: 20px; color: #7f1d1d; font-size: 13px;
                line-height: 1.8; white-space: pre-wrap; word-break: break-all }

    .log { background: #111827; border-radius: 12px; padding: 14px; margin-top: 16px;
        font-family: monospace; font-size: 12px; max-height: 240px; overflow-y: auto }
    .log-line { padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,.04) }
    .log-line.ok    { color: #4ade80 }
    .log-line.error { color: #f87171 }
    .log-line.info  { color: #93c5fd }
    .log-time { color: #4b5563; margin-right: 8px }

    .cmd { background: #1e1e2e; border-radius: 9px; padding: 12px 14px; font-family: monospace;
        font-size: 12px; color: #a5f3fc; margin: 8px 0; word-break: break-all }
    .note { font-size: 12px; color: #aaa; margin-top: 14px; padding: 10px 14px;
            background: #f9f9f9; border-radius: 9px; line-height: 1.8 }
    </style>
    </head>
    <body>
    <div class="card">
    <h1>Pesapal IPN Registration</h1>
    <p class="sub">
        Calls Pesapal's API from the server (bypasses CORS) and returns your IPN ID.<br>
        IPN URL: <strong><?= htmlspecialchars($IPN_URL) ?></strong>
    </p>

    <form method="POST">
        <label>Consumer Key</label>
        <input name="key" type="text" placeholder="From Pesapal dashboard → API Keys"
            value="<?= htmlspecialchars($_POST['key'] ?? '') ?>" autocomplete="off">

        <label>Consumer Secret</label>
        <input name="secret" type="password" placeholder="From Pesapal dashboard → API Keys" autocomplete="off">

        <label>Environment</label>
        <select name="env">
        <option value="sandbox" <?= ($_POST['env'] ?? 'sandbox') === 'sandbox' ? 'selected' : '' ?>>
            Sandbox (testing)
        </option>
        <option value="live" <?= ($_POST['env'] ?? '') === 'live' ? 'selected' : '' ?>>
            Live (real payments)
        </option>
        </select>

        <button type="submit" class="btn">Register IPN &amp; Get ID</button>
    </form>

    <?php if ($result): ?>
    <div class="success">
        <h2>✅ IPN Registered Successfully!</h2>
        <p>Your IPN ID (click to copy):</p>
        <div class="ipn-box" onclick="
        navigator.clipboard.writeText('<?= htmlspecialchars($result) ?>');
        this.textContent = 'Copied ✓';
        "><?= htmlspecialchars($result) ?></div>
        <p style="margin-top:12px">Now run these in your terminal:</p>
        <div class="cmd">supabase secrets set PESAPAL_IPN_ID=<?= htmlspecialchars($result) ?></div>
        <div class="cmd">supabase secrets set PESAPAL_CONSUMER_KEY=<?= htmlspecialchars($_POST['key'] ?? '') ?></div>
        <div class="cmd">supabase secrets set PESAPAL_CONSUMER_SECRET=YOUR_SECRET_HERE</div>
        <div class="cmd">supabase secrets set PESAPAL_SANDBOX=<?= ($_POST['env'] ?? 'sandbox') === 'sandbox' ? 'true' : 'false' ?></div>
        <div class="cmd">supabase secrets set PAYMENT_PROVIDER=pesapal</div>
    </div>
    <?php endif; ?>

    <?php if ($error): ?>
    <div class="error-box">❌ <?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <?php if (!empty($logs)): ?>
    <div class="log">
        <?php foreach ($logs as $l): ?>
        <div class="log-line <?= $l['type'] ?>">
        <span class="log-time"><?= $l['time'] ?></span><?= htmlspecialchars($l['msg']) ?>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <div class="note">
        <strong>After getting your IPN ID:</strong><br>
        1. Copy and run the commands above in your terminal<br>
        2. Delete or rename this file from your server (it contains your API keys in the form)
    </div>
</div>
</body>
</html>