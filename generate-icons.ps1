# generate-icons.ps1
# Rasteriza iconos a varios tamaños usando ImageMagick (`magick`)
# Ejecutar desde la carpeta del proyecto: `powershell -ExecutionPolicy Bypass -File .\generate-icons.ps1`

$src = "logo_principal.png"
if (-not (Test-Path $src)) {
    Write-Error "No se encontró $src en la raíz. Coloca el logo principal (PNG) con ese nombre."
    exit 1
}

$sizes = @(72,96,128,144,152,192,384,512)
foreach ($s in $sizes) {
    $out = "icon-$s.png"
    Write-Host "Generando $out ..."
    magick convert $src -resize ${s}x${s}^ -gravity center -extent ${s}x${s} $out
}

# apple-touch-icon (180 recommended by iOS)
Write-Host "Generando apple-touch-icon.png (180x180)..."
magick convert $src -resize 180x180^ -gravity center -extent 180x180 apple-touch-icon.png

# Favicon multi-resolution
Write-Host "Generando favicon.ico (16,32,48,64)..."
magick convert $src -define icon:auto-resize=16,32,48,64 favicon.ico

Write-Host "Iconos generados. Revise los archivos: icon-72.png, icon-96.png, icon-128.png, icon-144.png, icon-152.png, icon-192.png, icon-384.png, icon-512.png, apple-touch-icon.png, favicon.ico"
