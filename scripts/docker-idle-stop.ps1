# Para todo container do Docker quando não há dev server rodando nesta máquina.
#
#   powershell -File scripts/docker-idle-stop.ps1            # uma passada
#   powershell -File scripts/docker-idle-stop.ps1 -DryRun    # diz o que pararia, sem parar
#   powershell -File scripts/docker-idle-stop.ps1 -Install   # tarefa agendada, a cada 5 min
#   powershell -File scripts/docker-idle-stop.ps1 -Uninstall
#
# É a terceira peça do ciclo de vida dos containers — a rede de segurança. As
# outras duas moram no repositório: `restart: "no"` no `docker-compose.yml`
# (abrir o Docker Desktop não ressuscita nada) e `scripts/dev-with-db.mjs` (o
# dev server da API sobe o postgres antes e o para ao sair).
#
# ## Por que a rede de segurança é necessária — medido em 12/09/2026
#
# O `dev-with-db.mjs` para o banco na saída normal, no Ctrl+C e ao fechar a
# janela. Mas o painel de preview do editor (`preview_stop`) **mata a árvore de
# processos sem sinal nenhum**: medido — zero processos `node` sobrando, API
# fora do ar, e o `newranews-db` continuando `Up (healthy)`. `taskkill /F` e
# um travamento do terminal fazem o mesmo. Nenhum handler dentro do processo
# cobre isso; só alguém de fora, olhando o estado.
#
# ## A regra, e por que ela é assim
#
# A cada passada: se o Docker está respondendo, há container rodando **há mais
# de 3 minutos**, e **não existe nenhum processo de dev server** (`node.exe` /
# `turbo.exe` / `bun.exe` / `deno.exe` cuja linha de comando seja `tsx watch`,
# `turbo dev`, `next dev`, `vite`, `prisma studio`, …), então para todos.
#
# - **"Mais de 3 minutos"** é o que impede a passada de cair na janela entre o
#   `docker compose up` do wrapper e o `tsx` existir (≈5 s). Container recém-
#   nascido é de alguém que acabou de começar.
# - **Só `node.exe`/`turbo.exe`/…**, e não qualquer processo cuja linha de
#   comando cite as palavras: a primeira versão da busca casou os próprios
#   shells do agente, porque a linha de comando **deles** continha o texto da
#   busca.
# - **Para todos os containers, de todos os projetos.** É uma máquina de
#   desenvolvimento: container sem dev server é container esquecido. Com zero
#   containers por 5 min, o Resource Saver do Docker Desktop (4.24+) pausa a
#   VM e devolve o `vmmemWSL` ao Windows — é aí que a RAM volta.
# - **Nunca abre o Docker Desktop.** Se ele não está rodando, não há o que
#   fazer, e o script sai em silêncio.
#
# Escreve uma linha em `%LOCALAPPDATA%\docker-idle-stop.log` **só quando para
# alguma coisa** — passada sem ação não deixa rastro, senão o log cresce para
# sempre com "nada a fazer".
[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$DryRun,
  [int]$IdadeMinimaMin = 3
)

$ErrorActionPreference = 'Stop'
$TaskName = 'Docker idle stop (Newra News)'
$Log = Join-Path $env:LOCALAPPDATA 'docker-idle-stop.log'

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "tarefa '$TaskName' removida"
  exit 0
}

if ($Install) {
  $script = $PSCommandPath
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)
  $settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -RunLevel Limited -Force | Out-Null
  Write-Host "tarefa '$TaskName' registrada: a cada 5 min, rodando $script"
  exit 0
}

# --- uma passada ---

# Pelo `cmd /c` de propósito: no Windows PowerShell 5.1, `2>$null` num comando
# nativo com `$ErrorActionPreference = 'Stop'` vira erro **terminante** — o
# ramo "Docker parado", que é o que roda a cada 5 min com o Docker fechado,
# estourava em vez de sair em silêncio (medido em 12/09/2026).
$running = @(cmd /c 'docker ps --format "{{.Names}}" 2>nul')
if ($LASTEXITCODE -ne 0 -or $running.Count -eq 0) {
  if ($DryRun) { Write-Host 'Docker parado, ou nenhum container rodando — nada a fazer' }
  exit 0
}

$padraoDev = 'tsx watch|turbo(\.exe)?["'' ]+(run )?dev|next dev|next-server|vite|nodemon|ts-node-dev|prisma studio|wrangler dev|dev-with-db'
$devServers = Get-CimInstance Win32_Process |
  Where-Object { $_.Name -in 'node.exe', 'turbo.exe', 'bun.exe', 'deno.exe' -and $_.CommandLine -match $padraoDev }
if ($devServers) {
  if ($DryRun) { Write-Host ('dev server rodando (pid {0}) — nada a fazer' -f ($devServers.ProcessId -join ', ')) }
  exit 0
}

$limite = (Get-Date).ToUniversalTime().AddMinutes(-$IdadeMinimaMin)
$alvos = @(); $novos = @()
foreach ($nome in $running) {
  $estado, $inicio = (cmd /c "docker inspect --format `"{{.State.Status}}|{{.State.StartedAt}}`" $nome 2>nul") -split '\|'
  $startedAt = [datetime]::Parse($inicio, $null, 'AdjustToUniversal')
  # Container em loop de reinício nunca tem 3 min de vida — o `StartedAt` zera
  # a cada volta —, e a regra de idade o pouparia para sempre (medido em
  # 12/09/2026: um `supabase_vector` reiniciando a cada minuto). É alvo sempre.
  if ($estado -eq 'restarting' -or $startedAt -lt $limite) { $alvos += $nome } else { $novos += $nome }
}
if ($DryRun) {
  Write-Host ('sem dev server. pararia ({0}): {1}' -f $alvos.Count, ($alvos -join ', '))
  if ($novos) { Write-Host ('pouparia por terem menos de {0} min ({1}): {2}' -f $IdadeMinimaMin, $novos.Count, ($novos -join ', ')) }
  exit 0
}
if (-not $alvos) { exit 0 }   # só container recém-nascido

cmd /c "docker stop $($alvos -join ' ') >nul 2>nul"
$linha = '{0:yyyy-MM-dd HH:mm:ss} sem dev server — parados: {1}' -f (Get-Date), ($alvos -join ', ')
Add-Content -Path $Log -Value $linha -Encoding UTF8
Write-Host $linha
