# PowerShell script to kill all Node/Vite processes on ports 5173-5200
Write-Host "Searching for processes on ports 5173-5200..." -ForegroundColor Yellow

$ports = 5173..5200
$pids = @()

foreach ($port in $ports) {
    $connections = netstat -ano | findstr ":$port"
    if ($connections) {
        $connections | ForEach-Object {
            if ($_ -match '\s+(\d+)\s*$') {
                $pid = $matches[1]
                if ($pid -and $pid -notin $pids) {
                    $pids += $pid
                    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "Found process: $($process.ProcessName) (PID: $pid) on port $port" -ForegroundColor Cyan
                    }
                }
            }
        }
    }
}

if ($pids.Count -eq 0) {
    Write-Host "No processes found on ports 5173-5200" -ForegroundColor Green
} else {
    Write-Host "`nKilling $($pids.Count) process(es)..." -ForegroundColor Yellow
    foreach ($pid in $pids) {
        try {
            $process = Get-Process -Id $pid -ErrorAction Stop
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "✓ Killed process $($process.ProcessName) (PID: $pid)" -ForegroundColor Green
        } catch {
            Write-Host "✗ Failed to kill process (PID: $pid): $_" -ForegroundColor Red
        }
    }
    Write-Host "`nDone! All processes have been terminated." -ForegroundColor Green
}

