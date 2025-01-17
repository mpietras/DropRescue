import {
    Application, Assets, Geometry, Graphics, GraphicsPath, Mesh, MeshPlane, Shader, Sprite, Spritesheet, Texture, TilingSprite, RenderTexture,
    buildGeometryFromPath, WRAP_MODES
 } from './pixi.min.mjs';
const app = new Application();
const start_paused = true;
await app.init({ background: '#000022', resizeTo: window, autoStart: !start_paused });
document.body.appendChild(app.canvas);



const assets_sources = [
    { alias: 'spaceship', src: 'resources/spaceship.png' },
    { alias: 'asteroid1', src: 'resources/asteroid1.png' },
    { alias: 'asteroid2', src: 'resources/asteroid2.png' },
    { alias: 'asteroid3', src: 'resources/asteroid3.png' },
    { alias: 'rocks', src: 'resources/rocks.jpg' },
];
const assets = await Assets.load(assets_sources);



let asteroid_sheet_source = {
    frames: {
    },
    meta: {
        size: { w: 896, h: 896 },
        scale: 1
    }
};
for (let i = 0; i < 47; i++) {
    asteroid_sheet_source.frames[`asteroid_${i}`] = {
        frame: { x: i % 7 * 128, y: Math.floor(i / 7) * 128, w: 128, h: 128 },
        sourceSize: { w: 128, h: 128 },
        spriteSourceSize: { x: 0, y: 0, w: 128, h: 128 }
    };
}
const asteroid_max_seq = 46;

let asteroid_sprite_sheet = [];
asteroid_sprite_sheet.push(new Spritesheet(Texture.from('asteroid1'), asteroid_sheet_source));
asteroid_sprite_sheet.push(new Spritesheet(Texture.from('asteroid2'), asteroid_sheet_source));
asteroid_sprite_sheet.push(new Spritesheet(Texture.from('asteroid3'), asteroid_sheet_source));
for (let sheet of asteroid_sprite_sheet) {
    await sheet.parse();
}



const spaceship_sprite_sheet_source = {
    frames: {
        thrust_0: {
            frame: { x: 0, y: 0, w: 32, h: 32 },
            sourceSize: { w: 32, h: 32 },
            spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 }
        },
        thrust_1: {
            frame: { x: 32, y: 0, w: 32, h: 32 },
            sourceSize: { w: 32, h: 32 },
            spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 }
        },
        thrust_2: {
            frame: { x: 64, y: 0, w: 32, h: 32 },
            sourceSize: { w: 32, h: 32 },
            spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 }
        },
        thrust_3: {
            frame: { x: 96, y: 0, w: 32, h: 32 },
            sourceSize: { w: 32, h: 32 },
            spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 }
        },
        thrust_4: {
            frame: { x: 128, y: 0, w: 32, h: 32 },
            sourceSize: { w: 32, h: 32 },
            spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 }
        },
        thrust_5: {
            frame: { x: 160, y: 0, w: 32, h: 32 },
            sourceSize: { w: 32, h: 32 },
            spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 }
        }
    },
    meta: {
        size: { w: 192, h: 256 },
        scale: 1
    }
};

const spaceship_sprite_sheet = new Spritesheet(
	Texture.from('spaceship'),
	spaceship_sprite_sheet_source
);

await spaceship_sprite_sheet.parse();


const keyMap = {
    Space: 'space',
    KeyW: 'up',
    ArrowUp: 'up',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyS: 'down',
    ArrowDown: 'down',
    KeyD: 'right',
    ArrowRight: 'right',
};

// Class for handling keyboard inputs.
export class Controller {
    constructor() {
        this.paused = start_paused;

        this.keys = {
            up: { pressed: false, doubleTap: false, timestamp: 0 },
            left: { pressed: false, doubleTap: false, timestamp: 0 },
            down: { pressed: false, doubleTap: false, timestamp: 0 },
            right: { pressed: false, doubleTap: false, timestamp: 0 },
            space: { pressed: false, doubleTap: false, timestamp: 0 },
        };

        this.ptr = {
            left: false,
            right: false
        };

        // Register event listeners for keydown and keyup events.
        window.addEventListener('keydown', (event) => this.keydownHandler(event));
        window.addEventListener('keyup', (event) => this.keyupHandler(event));
        window.addEventListener('pointerdown', (event) => this.pointerdownHandler(event));
        window.addEventListener('pointerup', (event) => this.pointerupHandler(event));
    }

    keydownHandler(event) {
        if (event.code === 'KeyP') {
            this.paused = !this.paused;
            if (this.paused) {
                app.ticker.stop();
            }
            else {
                app.ticker.start();
            }
            return;
        }

        const key = keyMap[event.code];

        if (!key) {
            return;
        }

        const now = Date.now();

        // If not already in the double-tap state, toggle the double tap state if the key was pressed twice within 300ms.
        this.keys[key].doubleTap = this.keys[key].doubleTap || now - this.keys[key].timestamp < 300;

        // Toggle on the key pressed state.
        this.keys[key].pressed = true;
    }

    keyupHandler(event) {
        const key = keyMap[event.code];

        if (!key) {
            return;
        }

        const now = Date.now();

        // Reset the key pressed state.
        this.keys[key].pressed = false;

        // Reset double tap only if the key is in the double-tap state.
        if (this.keys[key].doubleTap) {
            this.keys[key].doubleTap = false;
        }
        // Otherwise, update the timestamp to track the time difference till the next potential key down.
        else {
            this.keys[key].timestamp = now;
        }
    }

    pointerdownHandler(event) {
        if (event.clientX < window.innerWidth / 2) {
            this.ptr.left = true;
        }
        else {
            this.ptr.right = true;
        }
    }

    pointerupHandler(event) {
        this.ptr.left = false;
        this.ptr.right = false;
    }
}

const controller = new Controller();


// put the stars out
const starCount = 20;
const graphics = new Graphics();

for (let index = 0; index < starCount; index++) {
    const x = Math.random() * app.screen.width;
    const y = Math.random() * app.screen.height;
    const radius = 2 + Math.random() * 3;
    const rotation = Math.random() * Math.PI * 2;

    graphics.star(x, y, 5, radius, 0, rotation).fill({ color: 0xffdf00, alpha: radius / 5 });
}

app.stage.addChild(graphics);

// create the land
const land_texture = Texture.from('rocks');
let land = new Graphics()
    .moveTo(0, 0)
    .lineTo(0, app.screen.height * .1)
    .lineTo(app.screen.width * .25, app.screen.height * .1)
    .lineTo(app.screen.width * .50, app.screen.height * .05)
    .lineTo(app.screen.width * .75, app.screen.height * .05)
    .lineTo(app.screen.width, app.screen.height * .15)
    .lineTo(app.screen.width, 0)
    .closePath()
    .fill(0xffffff);
const land_bounds = land.getBounds();
const landSprite = new TilingSprite(land_texture, land_bounds.width, land_bounds.height);
landSprite.x = 0;
landSprite.y = app.screen.height - land_bounds.height;
landSprite.addChild(land);
landSprite.tileScale.set(0.2);
landSprite.setMask({
     mask: land,
     inverse: true,
 });
app.stage.addChild(landSprite);


function collision(object1, object2) {
    // just a basic rectangle collision... we should do better
    const bounds1 = object1.getBounds();
    const bounds2 = object2.getBounds();

    console.log('comparing: ' + bounds1.x + ', ' + bounds1.y + ', ' + bounds1.width + ', ' + bounds1.height + ' with ' + bounds2.x + ', ' + bounds2.y + ', ' + bounds2.width + ', ' + bounds2.height);
    return bounds1.x < bounds2.x + bounds2.width
        && bounds1.x + bounds1.width > bounds2.x
        && bounds1.y < bounds2.y + bounds2.height
        && bounds1.y + bounds1.height > bounds2.y;
}



// put asteroids out
let asteroids = [];

function add_asteroid() {
    let sheet = asteroid_sprite_sheet[Math.floor(asteroid_sprite_sheet.length * Math.random())];
    let starting_seq = Math.floor(asteroid_max_seq * Math.random());
    let sprite = Sprite.from(sheet.textures[`asteroid_${starting_seq}`]);

    let collision_found = false;
    do {
        sprite.x = app.screen.width * Math.random();
        sprite.y = Math.floor(Math.floor((app.screen.height - 200) / 100) * Math.random()) * 100 + 100;
        collision_found = asteroids.some((asteroid) => collision(sprite, asteroid.sprite));
    } while (collision_found);

    app.stage.addChild(sprite);

    let asteroid = {
        sheet: sheet,
        sprite: sprite,
        seq: starting_seq,
        seq_sub: 0,
        rotational_direction: Math.random() < 0.5 ? -1 : 1,
        movement_direction: Math.random() < 0.5 ? -1 : 1,

        frame_advance: function () {
            this.seq_sub++;
            if (this.seq_sub == 8) {
                this.seq_sub = 0;
                this.seq += this.rotational_direction;
                if (this.seq > asteroid_max_seq) {
                    this.seq = 0;
                }
                else if (this.seq < 0) {
                    this.seq = asteroid_max_seq;
                }
                this.sprite.texture = this.sheet.textures[`asteroid_${this.seq}`];
            }

            this.sprite.x += this.movement_direction;
            if (this.sprite.x < -this.sprite.width) {
                this.sprite.x = app.screen.width + this.sprite.width;
            }
            else if (this.sprite.x > app.screen.width + this.sprite.width) {
                this.sprite.x = -this.sprite.width;
            }
        }
    };

    asteroids.push(asteroid);
}

for (let i = 0; i < 20; i++) {
    add_asteroid();
}



// put the spaceship out
const spaceship = Sprite.from(spaceship_sprite_sheet.textures['thrust_0']);

app.stage.addChild(spaceship);
spaceship.anchor.set(0.5);

spaceship.x = app.screen.width / 2;
spaceship.y = app.screen.height / 2;

const spaceship_height_meters = 8;
const gravity = 9.8 * 10;            // assume earth gravity in m/s^2
const pixels_per_meter = spaceship.height / spaceship_height_meters;
const frames_per_second = 60;
let velocity = 0; // px/frame
const acceleration_due_to_gravity = gravity / pixels_per_meter / frames_per_second / frames_per_second;    // px/frame^2
let thrust_level = 0;
const thrust_acceleration = acceleration_due_to_gravity / 2; // px/frame^2


app.ticker.add((time) => {
    if (controller.keys.right.pressed || controller.ptr.right) {
        spaceship.x += 2;
    }
    else if (controller.keys.left.pressed || controller.ptr.left) {
        spaceship.x -= 2;
    }
    //spaceship.rotation += 0.1 * time.deltaTime;
    let thrust_level_new;
    if (controller.keys.down.pressed) {
        thrust_level_new = Math.min(thrust_level + 1, 5);
    }
    else {
        thrust_level_new = Math.max(thrust_level - 1, 0);
    }
    if (thrust_level_new !== thrust_level) {
        thrust_level = thrust_level_new;
        spaceship.texture = spaceship_sprite_sheet.textures[`thrust_${thrust_level}`];
    }
    velocity += acceleration_due_to_gravity - thrust_level * thrust_acceleration;
    spaceship.y += velocity;


    for (let asteroid of asteroids) {
        asteroid.frame_advance();
    }
});

// paint one frame if we started paused
if (start_paused) {
    app.render();
}
