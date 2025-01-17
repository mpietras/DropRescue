// import what we need from the library
import {
    Application, Assets, Geometry, Graphics, GraphicsPath, Mesh, MeshPlane, Shader, Sprite, Spritesheet, Texture, TilingSprite, RenderTexture, Text,
    buildGeometryFromPath, WRAP_MODES
 } from './pixi.min.mjs';
const app = new Application();
const start_paused = true;
await app.init({ background: '#000022', resizeTo: window, autoStart: !start_paused });
document.body.appendChild(app.canvas);



// load all the assets
const assets_sources = [
    { alias: 'spaceship', src: 'resources/spaceship.png' },
    { alias: 'asteroid1', src: 'resources/asteroid1.png' },
    { alias: 'asteroid2', src: 'resources/asteroid2.png' },
    { alias: 'asteroid3', src: 'resources/asteroid3.png' },
    { alias: 'rocks', src: 'resources/rocks.jpg' },
];
const assets = await Assets.load(assets_sources);



// set up the asteroid sprite sheets
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
for (let i = 0; i < 3; i++) {
    let sheet = new Spritesheet(Texture.from(`asteroid${i + 1}`), asteroid_sheet_source);
    await sheet.parse();
    asteroid_sprite_sheet.push(sheet);
}



// set up the spaceship sprite sheet
let spaceship_sprite_sheet_source = {
    frames: {
    },
    meta: {
        size: { w: 192, h: 256 },
        scale: 1
    }
};

for (let i = 0; i < 6; i++) {
    spaceship_sprite_sheet_source.frames[`thrust_${i}`] = {
        frame: { x: i * 32, y: 0, w: 32, h: 32 },
        sourceSize: { w: 32, h: 32 },
        spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 }
    };
}

const spaceship_sprite_sheet = new Spritesheet(
	Texture.from('spaceship'),
	spaceship_sprite_sheet_source
);

await spaceship_sprite_sheet.parse();



// put out some help text
let help_text = new Text('p: pause/resume\nr: reset\nleft/right/down', { fontFamily: 'Arial', fontSize: 12, fill: 0xffffff, align: 'left' });
help_text.x = 0;
help_text.y = 0;
app.stage.addChild(help_text);

// put the stars out
let stars = {
    count: 20,
    graphics: null,

    create: function () {
        this.graphics = new Graphics();

        for (let index = 0; index < this.count; index++) {
            const x = Math.random() * app.screen.width;
            const y = Math.random() * app.screen.height;
            const radius = 2 + Math.random() * 3;
            const rotation = Math.random() * Math.PI * 2;

            this.graphics.star(x, y, 5, radius, 0, rotation).fill({ color: 0xffdf00, alpha: radius / 5 });
        }

        app.stage.addChild(this.graphics);
    },

    reset: function () {
        app.stage.removeChild(this.graphics);
        this.create();
    }
};
stars.create();



// create the land
let land = {
    graphics: null,
    sprite: null,

    create: function () {
        const land_texture = Texture.from('rocks');
        this.graphics = new Graphics()
            .moveTo(0, 0)
            .lineTo(0, app.screen.height * .1)
            .lineTo(app.screen.width * .25, app.screen.height * .1)
            .lineTo(app.screen.width * .50, app.screen.height * .05)
            .lineTo(app.screen.width * .75, app.screen.height * .05)
            .lineTo(app.screen.width, app.screen.height * .15)
            .lineTo(app.screen.width, 0)
            .closePath()
            .fill(0xffffff);
        const land_bounds = this.graphics.getBounds();
        this.sprite = new TilingSprite(land_texture, land_bounds.width, land_bounds.height);
        this.sprite.x = 0;
        this.sprite.y = app.screen.height - land_bounds.height;
        this.sprite.addChild(this.graphics);
        this.sprite.tileScale.set(0.2);
        this.sprite.setMask({
            mask: this.graphics,
            inverse: true,
        });
        app.stage.addChild(this.sprite);
    },

    reset: function () {
        this.sprite.removeChild(this.graphics);
        app.stage.removeChild(this.sprite);
        this.create();
    }
};
land.create();



function collision(object1, object2) {
    // just a basic rectangle collision for now... we must do better
    const bounds1 = object1.getBounds();
    const bounds2 = object2.getBounds();

    //console.log('comparing: ' + bounds1.x + ', ' + bounds1.y + ', ' + bounds1.width + ', ' + bounds1.height + ' with ' + bounds2.x + ', ' + bounds2.y + ', ' + bounds2.width + ', ' + bounds2.height);
    return bounds1.x < bounds2.x + bounds2.width
        && bounds1.x + bounds1.width > bounds2.x
        && bounds1.y < bounds2.y + bounds2.height
        && bounds1.y + bounds1.height > bounds2.y;
}



// our list of asteroids
let asteroids = [];

function add_asteroid() {
    // pick a random asteroid sprite sheet
    let sheet = asteroid_sprite_sheet[Math.floor(asteroid_sprite_sheet.length * Math.random())];

    // pick a random starting sequence
    let starting_seq = Math.floor(asteroid_max_seq * Math.random());

    // create the sprite with that starting sequence
    let sprite = Sprite.from(sheet.textures[`asteroid_${starting_seq}`]);

    // pick a random scale from 0.25 to 1.0
    let scale = 0.25 + 0.75 * Math.random();
    sprite.scale.set(scale);

    // place the sprite randomly on the screen, but not overlapping with any other asteroid
    let collision_found = 0;
    do {
        sprite.x = app.screen.width * Math.random();
        sprite.y = Math.floor(Math.floor((app.screen.height - 200) / 100) * Math.random()) * 100 + 100;
        if (asteroids.some((asteroid) => collision(sprite, asteroid.sprite))) {
            collision_found++;
        }
        else {
            break;
        }
    } while (collision_found < 30);

    // put it in our stage
    app.stage.addChild(sprite);

    // create the asteroid object
    let asteroid = {
        // the spritesheet and the sprite
        sheet: sheet,
        sprite: sprite,

        // the sequence of the sheet, and a sub-sequence for dealing with the animation speed
        seq: starting_seq,
        seq_sub: 0,

        // the direction of rotation and movement
        rotational_speed: Math.random() * 2 - 1,    // between -1 and 1
        movement_speed: Math.random() * 6 - 3,  // between -3 and 3

        // advance the asteroid by one frame
        frame_advance: function () {
            // update the animation frame
            this.seq_sub++;
            if (this.seq_sub == 8) {
                this.seq_sub = 0;
                this.seq += this.rotational_speed;
                if (this.seq > asteroid_max_seq) {
                    this.seq -= asteroid_max_seq;
                }
                else if (this.seq < 0) {
                    this.seq += asteroid_max_seq;
                }
                this.sprite.texture = this.sheet.textures[`asteroid_${Math.floor(this.seq)}`];
            }

            // update the movement, and wrap around if necessary
            this.sprite.x += this.movement_speed;
            if (this.sprite.x < -this.sprite.width) {
                this.sprite.x = app.screen.width + this.sprite.width;
            }
            else if (this.sprite.x > app.screen.width + this.sprite.width) {
                this.sprite.x = -this.sprite.width;
            }
        }
    };

    // save this asteroid in our list
    asteroids.push(asteroid);
}

function asteroids_create() {
    // create a bunch of asteroids
    for (let i = 0; i < 20; i++) {
        add_asteroid();
    }
}

function asteroids_reset() {
    // remove all the asteroids
    for (let asteroid of asteroids) {
        app.stage.removeChild(asteroid.sprite);
    }

    // clear the list
    asteroids = [];

    // create a new set of asteroids
    asteroids_create();
}

asteroids_create();



// the main spaceship
let spaceship = {
    sprite: null,
    thrust_level: 0,
    thrust_acceleration: 0,
    velocity: 0,
    acceleration_due_to_gravity: 0,

    create: function () {
        this.sprite = Sprite.from(spaceship_sprite_sheet.textures['thrust_0']);

        app.stage.addChild(this.sprite);
        this.sprite.anchor.set(0.5);

        this.sprite.x = app.screen.width / 2;
        this.sprite.y = app.screen.height / 2;

        const spaceship_height_meters = 8;
        const gravity = 9.8 * 10;            // assume earth gravity in m/s^2
        const pixels_per_meter = this.sprite.height / spaceship_height_meters;
        const frames_per_second = 60;
        this.velocity = 0; // px/frame
        this.acceleration_due_to_gravity = gravity / pixels_per_meter / frames_per_second / frames_per_second;    // px/frame^2
        this.thrust_level = 0;
        this.thrust_acceleration = this.acceleration_due_to_gravity / 2; // px/frame^2
    },

    frame_advance: function (thrust_level_new) {
        // update the sprite if the thrust level changed
        if (thrust_level_new !== spaceship.thrust_level) {
            spaceship.thrust_level = thrust_level_new;
            spaceship.sprite.texture = spaceship_sprite_sheet.textures[`thrust_${spaceship.thrust_level}`];
        }

        // update the velocity and position
        this.velocity += this.acceleration_due_to_gravity - this.thrust_level * this.thrust_acceleration;
        this.sprite.y += this.velocity;
    },

    reset: function () {
        app.stage.removeChild(this.sprite);
        this.create();
    }
};

spaceship.create();



// Keyboard mapping for the game.
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


// class for handling keyboard inputs.
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
        else if (event.code === 'KeyR') {
            // reset the game
            app.stop();
            controller.paused = true;
            stars.reset();
            asteroids_reset();
            spaceship.reset();
            app.render();
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




// the main game loop
app.ticker.add((time) => {
    // check for placeholder left/right controller input
    if (controller.keys.right.pressed || controller.ptr.right) {
        spaceship.sprite.x += 2;
    }
    else if (controller.keys.left.pressed || controller.ptr.left) {
        spaceship.sprite.x -= 2;
    }

    // check for controller thrust input
    let thrust_level_new;
    if (controller.keys.down.pressed) {
        thrust_level_new = Math.min(spaceship.thrust_level + 1, 5);
    }
    else {
        thrust_level_new = Math.max(spaceship.thrust_level - 1, 0);
    }

    // update the spaceship with the new thrust level
    spaceship.frame_advance(thrust_level_new);

    // update the asteroids
    for (let asteroid of asteroids) {
        asteroid.frame_advance();
    }

    // check for collisions between ship and anything
    if (asteroids.some((asteroid) => collision(spaceship.sprite, asteroid.sprite))) {
        app.stop();
    }
    if (collision(spaceship.sprite, land.sprite)) {
        app.stop();
    }
});



// paint one frame if we started paused
if (start_paused) {
    app.render();
}
