setup:
	git submodule update --init --recursive

generated-sources.json:
	flatpak-node-generator npm package-lock.json -o generated-sources.json

clean:
	rm -rf ./flatpak_prod
	rm -rf ./flatpak_app
	rm -rf .flatpak-builder
	rm -rf ./builddir
	rm -rf ./repo
	rm -rf ./eslint-report.txt

lint:
	npx eslint -o eslint-report.txt --no-color src || { cat eslint-report.txt; false; }

test:
	npx jest test

build: generated-sources.json
	npm run bundle:temporal
	flatpak-builder --user --force-clean flatpak_app build-aux/flatpak/ca.deobald.Kaya.json

install:
	flatpak-builder --user --install --force-clean _build_install build-aux/flatpak/ca.deobald.Kaya.json

# NOTE: Do not use `flatpak-builder --run` here. It creates an incomplete
# sandbox that lacks proper document portal FUSE integration, which breaks
# drag-and-drop file access from file managers on Wayland.
run: install
	flatpak run ca.deobald.Kaya

uninstall:
	flatpak uninstall ca.deobald.Kaya

flatpak-build:
	flatpak-builder --user --force-clean --repo=repo flatpak_prod ca.deobald.Kaya.json
	flatpak build-bundle repo ca.deobald.Kaya.flatpak ca.deobald.Kaya

flatpak-install:
	flatpak run --command=flathub-build org.flatpak.Builder --install ca.deobald.Kaya.json

flatpak-lint:
	flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest ca.deobald.Kaya.json

flatpak-run:
	flatpak run ca.deobald.Kaya

# --- macOS targets ---

macos-deps:
	@echo "Installing macOS build dependencies via Homebrew..."
	brew install gjs gtk4 libadwaita libsoup gobject-introspection \
		adwaita-icon-theme gdk-pixbuf meson ninja node \
		dylibbundler create-dmg librsvg

macos-build:
	bash build-aux/macos/bundle.sh

macos-dmg: macos-build
	bash build-aux/macos/create-dmg.sh Kaya.app Kaya.dmg

macos-run: macos-build
	open Kaya.app

macos-clean:
	rm -rf builddir-macos
	rm -rf Kaya.app
	rm -f *.dmg


