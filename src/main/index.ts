'use strict';

import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, ipcMain } from 'electron';
import windowStateKeeper from 'electron-window-state';
import { join as joinPath } from 'path';
import { format as formatUrl } from 'url';
import './hook';
import { overlayWindow } from 'electron-overlay-window';

const isDevelopment = process.env.NODE_ENV !== 'production';

declare global {
  namespace NodeJS {
    interface Global {
       mainWindow: BrowserWindow|null;
	   overlay: BrowserWindow|null;
    } 
  }
}
// global reference to mainWindow (necessary to prevent window from being garbage collected)
global.mainWindow = null;
global.overlay = null;

app.commandLine.appendSwitch('disable-pinch');

function createMainWindow() {
	const mainWindowState = windowStateKeeper({});

	const window = new BrowserWindow({
		width: 250,
		height: 350,
		maxWidth: 250,
		minWidth: 250,
		maxHeight: 350,
		minHeight: 350,
		x: mainWindowState.x,
		y: mainWindowState.y,

		resizable: false,
		frame: false,
		fullscreenable: false,
		maximizable: false,
		transparent: true,
		webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: true,
			webSecurity: false
		}
	});

	mainWindowState.manage(window);

	if (isDevelopment) {
		window.webContents.openDevTools();
	}

	if (isDevelopment) {
		window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}?version=1.1.97&view=app`);
	}
	else {
		window.loadURL(formatUrl({
			pathname: joinPath(__dirname, 'index.html'),
			protocol: 'file',
			query: {
				version: autoUpdater.currentVersion.version,
				view: "app"
			},
			slashes: true
		}));
	}

	window.on('closed', () => {
		console.log("window-all-closed")
		global.mainWindow = null;
		global.overlay?.close();
		global.overlay = null;
		app.exit(0);
	});

	window.webContents.on('devtools-opened', () => {
		window.focus();
		setImmediate(() => {
			window.focus();
		});
	});

	return window;
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
	app.quit();
} else {
	autoUpdater.checkForUpdatesAndNotify();
	app.on('second-instance', () => {
		// Someone tried to run a second instance, we should focus our window.
		if (global.mainWindow) {
			if (global.mainWindow.isMinimized()) global.mainWindow.restore();
			global.mainWindow.focus();
		}
	});

	function createOverlay() {
		const overlay = new BrowserWindow({
			width: 400,
			height: 300,
		//	alwaysOnTop:true,
			focusable: false,
			webPreferences: {
				nodeIntegration: true,
				enableRemoteModule: true,
				webSecurity: false
			},
			...overlayWindow.WINDOW_OPTS
		});

		if (isDevelopment) {
			overlay.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}?version=${autoUpdater.currentVersion.version}&view=overlay`)
		} else {
			overlay.loadURL(formatUrl({
				pathname: joinPath(__dirname, 'index.html'),
				protocol: 'file',
				query: {
					version: autoUpdater.currentVersion.version,
					view: "overlay"
				},
				slashes: true
			}))
		}
		
		if (isDevelopment) {
			overlay.webContents.openDevTools();
		}

		overlay.setIgnoreMouseEvents(true);
		overlayWindow.attachTo(overlay, 'Among Us');
		return overlay;
	}

	// quit application when all windows are closed
	app.on('window-all-closed', () => {
		if (isDevelopment) {
			return;
		}
		// on macOS it is common for applications to stay open until the user explicitly quits
		if (process.platform !== 'darwin') {
			if (global.overlay != null) {
				global.overlay.close()
				global.overlay = null;
			}
			app.quit();
		}
	});

	app.on('activate', () => {
		// on macOS it is common to re-create a window even after all windows have been closed
		if (global.mainWindow === null) {
			global.mainWindow = createMainWindow();
		} 
	});

	// create main BrowserWindow when electron is ready
	app.on('ready', () => {
		global.mainWindow = createMainWindow();
		global.overlay = createOverlay();
	});

	ipcMain.on('enableOverlay', async (_event,enable)=> {
		if(enable)
		overlayWindow.show();
		else
		overlayWindow.hide();
	});
	
}