# Cómo subir esto a GitHub

Desde la carpeta descomprimida, en la terminal:

```bash
git init
git add .
git commit -m "Primera versión de Huellas a Casa"
git branch -M main
git remote add origin https://github.com/LAHoyosC/huellas-a-casa.git
git push -u origin main
```

Antes de correr eso, crea el repositorio vacío en
https://github.com/new — nombre `huellas-a-casa`, **sin** marcar
"Add a README" (este paquete ya lo trae).

Si el repositorio va a ser público, revisa que `.env` NO esté
incluido. Ya está en `.gitignore`, pero verifica con `git status`
antes del primer commit.
