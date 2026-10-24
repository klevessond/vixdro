\xef\xbb\xbf# publicar-site.ps1
#
# Gera o site do Orçaminio e publica no servidor, com conferências antes de
# enviar. Fica na raiz do projeto do app (ao lado do package.json).
#
# Como rodar, no PowerShell, dentro da pasta do projeto:
#     .\publicar-site.ps1
#
# Sem chave SSH configurada, o servidor pede a senha duas vezes:
# uma para enviar os arquivos e outra para trocar a versão.

# ---------- Configuração ----------
$Servidor = "168.119.245.32"
$Usuario  = "root"
$Dominio  = "app.orcaminio.com.br"
$Pasta    = "/var/www/orcaminio"
# ----------------------------------

$ErrorActionPreference = "Stop"

function Parar($mensagem) {
    Write-Host ""
    Write-Host "PAROU: $mensagem" -ForegroundColor Red
    Write-Host "Nada foi alterado no servidor." -ForegroundColor Red
    exit 1
}

function Passo($mensagem) {
    Write-Host ""
    Write-Host "==> $mensagem" -ForegroundColor Cyan
}

# 1. Conferências antes de gerar
Passo "Conferindo a configuração"

if (-not (Test-Path "package.json") -or -not (Test-Path "app.json")) {
    Parar "rode o script de dentro da pasta do projeto do app (onde ficam o package.json e o app.json)."
}

if (-not (Test-Path ".env.production")) {
    Parar "falta o arquivo .env.production com EXPO_PUBLIC_API_URL=https://$Dominio/api/v1"
}
$linhaProducao = Select-String -Path ".env.production" -Pattern "^\s*EXPO_PUBLIC_API_URL\s*=\s*(.+)$"
if (-not $linhaProducao) {
    Parar "o .env.production não tem a linha EXPO_PUBLIC_API_URL."
}
$urlProducao = $linhaProducao.Matches[0].Groups[1].Value.Trim()
if ($urlProducao -notlike "https://$Dominio/*") {
    Parar "o .env.production aponta para '$urlProducao', e não para https://$Dominio"
}

# Um .env.local passaria na frente do .env.production.
if ((Test-Path ".env.local") -and (Select-String -Path ".env.local" -Pattern "EXPO_PUBLIC_API_URL" -Quiet)) {
    Parar "o .env.local também define EXPO_PUBLIC_API_URL e passaria na frente do .env.production. Tire a linha de lá."
}

# Uma variável definida no terminal também passaria na frente: ignora nesta execução.
if ($env:EXPO_PUBLIC_API_URL) {
    Write-Host "Aviso: este terminal tinha EXPO_PUBLIC_API_URL='$($env:EXPO_PUBLIC_API_URL)'; ignorando nesta publicação." -ForegroundColor Yellow
    Remove-Item Env:EXPO_PUBLIC_API_URL
}
Write-Host "Endereço da API no site: $urlProducao"

# 2. Gerar o site
Passo "Gerando o site (npx expo export)"
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
npx expo export -p web --clear
if ($LASTEXITCODE -ne 0) { Parar "o npx expo export falhou (veja as mensagens acima)." }

# 3. Conferir o resultado
Passo "Conferindo o site gerado"
if (-not (Test-Path "dist\index.html")) {
    Parar "o export não gerou o dist\index.html."
}
$scripts = Get-ChildItem -Path "dist" -Recurse -Filter "*.js"
$achou = $scripts | Select-String -Pattern ([regex]::Escape($Dominio)) -List | Select-Object -First 1
if (-not $achou) {
    Parar "o site gerado não contém $Dominio. Confira o .env.production e rode de novo."
}
$achouDev = $scripts | Select-String -Pattern "${Servidor}:80" -List | Select-Object -First 1
if ($achouDev) {
    Parar "o site gerado contém o endereço de desenvolvimento ($Servidor). Confira os arquivos .env."
}
Write-Host "OK: o site aponta para $Dominio."

# 4. Enviar para uma pasta nova (a versão no ar continua intacta)
$carimbo = Get-Date -Format "yyyyMMdd-HHmmss"
$destino = "$Pasta/site-nova-$carimbo"
Passo "Enviando para o servidor (senha do SSH, 1 de 2)"
scp -r dist "${Usuario}@${Servidor}:$destino"
if ($LASTEXITCODE -ne 0) { Parar "o envio falhou (senha, conexão ou espaço no servidor)." }

# 5. Trocar a versão no ar, guardando a anterior para poder voltar
Passo "Colocando a versão nova no ar (senha do SSH, 2 de 2)"
$troca = "set -e; " +
         "test -f $destino/index.html; " +
         "rm -rf $Pasta/site-anterior; " +
         "if [ -d $Pasta/site ]; then mv $Pasta/site $Pasta/site-anterior; fi; " +
         "mv $destino $Pasta/site; " +
         "chmod -R a+rX $Pasta/site; " +
         "rm -rf $Pasta/site-nova-*"
ssh "${Usuario}@${Servidor}" $troca
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "A troca falhou. A versão que estava no ar foi mantida (ou está em $Pasta/site-anterior)." -ForegroundColor Red
    exit 1
}

# 6. Conferir no ar
Passo "Conferindo https://$Dominio"
try {
    $resposta = Invoke-WebRequest -Uri "https://$Dominio" -UseBasicParsing -TimeoutSec 20
    Write-Host "O site respondeu (código $($resposta.StatusCode))." -ForegroundColor Green
} catch {
    Write-Host "Aviso: o site não respondeu agora ($($_.Exception.Message)). Abra no navegador para conferir." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Publicado! Quem estiver com o site aberto vê a versão nova ao recarregar a página." -ForegroundColor Green
Write-Host "Para voltar à versão anterior:" -ForegroundColor Gray
Write-Host "  ssh ${Usuario}@${Servidor} `"rm -rf $Pasta/site && mv $Pasta/site-anterior $Pasta/site`"" -ForegroundColor Gray
