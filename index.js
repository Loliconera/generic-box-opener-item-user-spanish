/* eslint-disable no-param-reassign */

module.exports = function boxOpener(dispatch) {
	const command = dispatch.command || dispatch.require.command;

	let	hooks = [],
		enabled = false,
		boxEvent = null,
		gacha_detected = false,
		isLooting = false,
		location = null,
		timer = null,
		delay = 5500,
		useDelay = false,
		statOpened = 0,
		statUsed = 0,
		statStarted = null,
		scanning = false;

	command.add("box", () => {
		if (!enabled && !scanning) {
			scanning = true;
			load();
			command.message("Por lo general, abra una caja ahora y el script continuará abriéndolo.");
		} else {
			stop();
		}
	});

	command.add("boxdelay", (arg) => {
		if (arg === "0") {
			useDelay = false;
			delay = 5500;
			command.message("Desactivar el retraso mínimo de apertura de la caja, disfrute de la velocidad");
		} else if (!isNaN(arg)) {
			useDelay = true;
			delay = parseInt(arg);
			command.message(`El retardo mínimo de apertura de la caja se establece en: ${ delay / 1000 } segundos`);
		} else {
			command.message(`El retardo mínimo de apertura de la caja se establece en: ${ useDelay ? `${delay / 1000 } segundos` : "no delay"}`);
		}
	});

	dispatch.hook("C_PLAYER_LOCATION", 5, event => {location = event;});

	dispatch.game.initialize("inventory");

	dispatch.game.inventory.on("update", () => {
		if (!enabled) return;

		isLooting = false;
	});

	function load() {
		hook("C_USE_ITEM", 3, event => {
			if (!scanning) return;

			if (scanning) {
				boxEvent = event;
				boxEvent.dbid = 0n; // para abrir todas las ranuras de inventario
				command.message(`Caja establecido en: ${event.id}, procediendo a abrirlo automáticamente con ${ useDelay ? `un retraso mínimo de ${ delay / 1000 } segundos` : "no delay"}`);
				scanning = false;

				const d = new Date();
				statStarted = d.getTime();
				enabled = true;
				timer = setTimeout(openBox, delay);
				return true; // para la consistencia de los datos enviados
			}
		});

		hook("S_SYSTEM_MESSAGE_LOOT_ITEM", 1, event => {
			if (!gacha_detected && !isLooting && boxEvent) {
				isLooting = true;
				statOpened++;
				if (!useDelay) {
					dispatch.clearTimeout(timer);
					openBox();
				}
			}
		});

		hook("S_GACHA_END", 1, () => {
			if (boxEvent) {
				statOpened++;
				if (!useDelay) {
					clearTimeout(timer);
					openBox();
				}
			}
		});

		hook("S_SYSTEM_MESSAGE", 1, event => {
			const msg = dispatch.parseSystemMessage(event.message);
			if (msg.id === "SMT_ITEM_MIX_NEED_METERIAL" || msg.id === "SMT_CANT_CONVERT_NOW") {
				command.message("La caja ya no se puede abrir, deteniéndose");
				stop();
			}
		});

		hook("S_GACHA_START", 1, event => {
			gacha_detected = true;
			dispatch.send("C_GACHA_TRY", 1, {
				"id": event.id
			});
		});
	}

	function openBox() {
		if (dispatch.game.inventory.getTotalAmount(boxEvent.id) > 0) {
			boxEvent.loc = location.loc;
			boxEvent.w = location.w;
			dispatch.send("C_USE_ITEM", 3, boxEvent);
			if (useDelay) {
				statUsed++;	// counter for used items other than boxes
			}
			timer = setTimeout(openBox, delay);
		} else {
			command.message("Te quedaste sin cajas, parando");
			stop();
		}
	}

	function addZero(i) {
		if (i < 10) {
			i = `0${ i}`;
		}
		return i;
	}

	function stop() {
		unload();
		if (scanning) {
			scanning = false;
			command.message("Se cancela la búsqueda de una caja");
		} else {
			clearTimeout(timer);
			enabled = false;
			gacha_detected = false;
			boxEvent = null;
			if (useDelay && statOpened == 0) {
				statOpened = statUsed;
			}
			let d = new Date();
			const t = d.getTime();
			const timeElapsedMSec = t - statStarted;
			d = new Date(1970, 0, 1); // Epoch
			d.setMilliseconds(timeElapsedMSec);
			const h = addZero(d.getHours());
			const m = addZero(d.getMinutes());
			const s = addZero(d.getSeconds());
			command.message(`El abridor de cajas se detuvo. Abrió: ${ statOpened } cajas. Tiempo transcurrido: ${ h }:${ m }:${ s }. Por caja: ${ ((timeElapsedMSec / statOpened) / 1000).toPrecision(2) } segundos`);
			statOpened = 0;
			statUsed = 0;
		}
	}

	function unload() {
		if (hooks.length) {
			for (const h of hooks) dispatch.unhook(h);

			hooks = [];
		}
	}

	function hook() {
		hooks.push(dispatch.hook(...arguments));
	}
};