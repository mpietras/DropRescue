const app = new PIXI.Application();
const start_paused = true;

// list the assets we'll need
const assets_sources = [
    { alias: 'spaceship', src: 'resources/spaceship.png' },
    { alias: 'asteroid1', src: 'resources/asteroid1.png' },
    { alias: 'asteroid2', src: 'resources/asteroid2.png' },
    { alias: 'asteroid3', src: 'resources/asteroid3.png' },
    { alias: 'rocks', src: 'resources/rocks.jpg' },
];
let assets = null;



// set up the asteroid sprite sheets
let asteroid_sprite_sheet = [];
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

let spaceship_sprite_sheet = null;



function asteroid_sheet_parser(i) {
    let sheet = new PIXI.Spritesheet(PIXI.Texture.from(`asteroid${i + 1}`), asteroid_sheet_source);
    sheet.parse().then(() => {
        asteroid_sprite_sheet.push(sheet);
        if (i < 2) {
            asteroid_sheet_parser(i + 1);
        }
        else {
            spaceship_sprite_sheet = new PIXI.Spritesheet(
                PIXI.Texture.from('spaceship'),
                spaceship_sprite_sheet_source
            );
            spaceship_sprite_sheet.parse().then(() => {
                stars.create();
                land.create();
                asteroids_create();
                spaceship.create();
                run();
            });
        }
    });
}

// when document loads, start initializing the game
document.addEventListener('DOMContentLoaded', () => {
    app.init({ background: '#000022', resizeTo: window, autoStart: !start_paused }).then(() => {
        document.body.appendChild(app.canvas);
        assets = PIXI.Assets.load(assets_sources).then(() => {
            asteroid_sheet_parser(0);
        });
    });
});



class Edge {
  
    constructor(p1 = new PIXI.Point(), p2 = new PIXI.Point()) {
        this.p1 = p1;
        this.p2 = p2;
    }
  
    intersects(edge, asSegment = true, point = new PIXI.Point()) {
        const a = this.p1;
        const b = this.p2;
        const e = edge.p1;
        const f = edge.p2;
    
        const a1 = b.y - a.y;
        const a2 = f.y - e.y;
        const b1 = a.x - b.x;
        const b2 = e.x - f.x;
        const c1 = (b.x * a.y) - (a.x * b.y);
        const c2 = (f.x * e.y) - (e.x * f.y);
        const denom = (a1 * b2) - (a2 * b1);
    
        if (denom === 0) {
            return null;
        }
       
        point.x = ((b1 * c2) - (b2 * c1)) / denom;
        point.y = ((a2 * c1) - (a1 * c2)) / denom;

        if (asSegment) {
            const uc = ((f.y - e.y) * (b.x - a.x) - (f.x - e.x) * (b.y - a.y));
            const ua = (((f.x - e.x) * (a.y - e.y)) - (f.y - e.y) * (a.x - e.x)) / uc;
            const ub = (((b.x - a.x) * (a.y - e.y)) - ((b.y - a.y) * (a.x - e.x))) / uc;

            if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
                return point;
            }
            else {
                return null;
            }
        }

        return point;
    }
}



class CollisionShape {
  
    constructor(target, vertices = []) {
        this.edges = [];
        this.points = [];
        this.bounds = new PIXI.Bounds();
        this.intersectionPoint = new PIXI.Point();
        this.target = target;
        this.vertices = vertices;
                
        for (let i = 0; i < vertices.length; i++) {
            const p1 = vertices[i];
            const p2 = vertices[i + 1] || vertices[0];
            this.points.push(p1.clone());
            this.edges.push(new Edge(p1, p2));
        }
    
        this.update();
    }
  
    point_inside(point) {
        const num_vertices = this.vertices.length;
        let inside = false;
    
        let p1 = this.vertices[0];
        let p2;
    
        for (let i = 1; i <= num_vertices; i++) {
            p2 = this.vertices[i % num_vertices];
    
            if (point.y > Math.min(p1.y, p2.y)) {
                if (point.y <= Math.max(p1.y, p2.y)) {
                    if (point.x <= Math.max(p1.x, p2.x)) {
                        const x_intersection = ((point.y - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y) + p1.x;
    
                        if (p1.x === p2.x || point.x <= x_intersection) {
                            inside = !inside;
                        }
                    }
                }
            }
    
            p1 = p2;
        }
    
        return inside;
    }

    all_points_inside(shape) {
        for (let i = 0; i < this.vertices.length; i++) {
            if (!shape.point_inside(this.vertices[i])) {
                return false;
            }
        }
    
        return true;
    }
    
    update() {
        const transform = this.target.worldTransform;
        const vertices = this.vertices;
        const points = this.points;
        this.bounds = new PIXI.Bounds();
    
        for (let i = 0; i < points.length; i++) {
            const vertex = transform.apply(points[i], vertices[i]);

            this.bounds.minX = Math.min(this.bounds.minX, vertex.x);
            this.bounds.maxX = Math.max(this.bounds.maxX, vertex.x);
            this.bounds.minY = Math.min(this.bounds.minY, vertex.y);
            this.bounds.maxY = Math.max(this.bounds.maxY, vertex.y);
        }
    }
  
    intersects(shape) {
        if (this.bounds.maxX < shape.bounds.minX ||
            this.bounds.maxY < shape.bounds.minY ||
            this.bounds.minX > shape.bounds.maxX ||
            this.bounds.minY > shape.bounds.maxY
        ) {
            // no basic bounds intersection
            return false;
        }
        else {
            // check for edge collision
            for (let i = 0; i < this.edges.length; i++) {
                const edge1 = this.edges[i];
                for (let j = 0; j < shape.edges.length; j++) {
                    if (edge1.intersects(shape.edges[j], true, this.intersectionPoint)) {
                        return true;
                    }
                }
            }

            // check for full containment
            if (this.all_points_inside(shape) || shape.all_points_inside(this)) {
                return true;
            }

            // no edge collision
            return false;
        }
    }
}



// put out some help text
let help_text = new PIXI.Text(
    'p: pause/resume\nr: reset\nleft/right/down',
    { fontFamily: 'Arial', fontSize: 12, fill: 0xffffff, align: 'left' }
);
help_text.x = 0;
help_text.y = 0;
app.stage.addChild(help_text);



// put the stars out
let stars = {
    count: 20,
    graphics: null,

    create: function () {
        this.graphics = new PIXI.Graphics();

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



// create the land
let land = {
    graphics: null,
    sprite: null,
    shape: null,

    create: function () {
        const land_texture = PIXI.Texture.from('rocks');

        // create some random land within 10% of the bottom of the screen
        // create points between 1-10% width for each step to the right
        let points = [];
        let ten_ph = app.screen.height * .1;
        let one_pw = app.screen.width * .01;
        let ten_pw = app.screen.width * .09;
        points.push(new PIXI.Point(0, app.screen.height));
        points.push(new PIXI.Point(0, app.screen.height - Math.random() * ten_ph));
        let x = 0;
        do {
            x += Math.random() * ten_pw + one_pw;
            if (x > app.screen.width) {
                x = app.screen.width;
            }
            points.push(new PIXI.Point(x, app.screen.height - Math.random() * ten_ph));
        } while (x < app.screen.width);
        points.push(new PIXI.Point(app.screen.width, app.screen.height));
        points.push(new PIXI.Point(0, app.screen.height));

        this.graphics = new PIXI.Graphics();
        this.graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.graphics.lineTo(points[i].x, points[i].y);
        }
        this.graphics.closePath();
        this.graphics.fill(0xffffff);
    
        this.sprite = new PIXI.TilingSprite(land_texture, app.screen.width, app.screen.height);
        this.sprite.x = 0;
        this.sprite.y = 0;
        this.sprite.addChild(this.graphics);
        this.sprite.tileScale.set(0.2);
        this.sprite.setMask({
            mask: this.graphics
        });

        this.shape = new CollisionShape(this.sprite, points);

        app.stage.addChild(this.sprite);
    },

    reset: function () {
        this.sprite.removeChild(this.graphics);
        app.stage.removeChild(this.sprite);
        this.create();
    }
};



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
    let sprite = PIXI.Sprite.from(sheet.textures[`asteroid_${starting_seq}`]);

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



// the main spaceship
let spaceship = {
    sprite: null,
    thrust_level: 0,
    thrust_acceleration: 0,
    velocity: 0,
    acceleration_due_to_gravity: 0,
    shape: null,

    create: function () {
        this.sprite = PIXI.Sprite.from(spaceship_sprite_sheet.textures['thrust_0']);

        app.stage.addChild(this.sprite);

        this.sprite.x = app.screen.width / 2;
        this.sprite.y = app.screen.height / 2;
        this.shape = new CollisionShape(this.sprite, this.points);

        const spaceship_height_meters = 8;
        const gravity = 9.8 * 10;            // assume earth gravity in m/s^2
        const pixels_per_meter = this.sprite.height / spaceship_height_meters;
        const frames_per_second = 60;
        this.velocity = 0; // px/frame
        this.acceleration_due_to_gravity = gravity / pixels_per_meter / frames_per_second / frames_per_second;    // px/frame^2
        this.thrust_level = 0;
        this.thrust_acceleration = this.acceleration_due_to_gravity / 2; // px/frame^2
    },

    hit: function(collision) {
        if (collision) {
            this.sprite.tint = 0xff0000;
        }
        else {
            this.sprite.tint = 0xffffff;
        }
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

        // update the collision location
        this.shape.update();
    },

    reset: function () {
        app.stage.removeChild(this.sprite);
        this.create();
    },

    points: [
        new PIXI.Point(14, 4),
        new PIXI.Point(18, 4),
        new PIXI.Point(27, 20),
        new PIXI.Point(27, 26),
        new PIXI.Point(19, 29),
        new PIXI.Point(13, 29),
        new PIXI.Point(5, 26),
        new PIXI.Point(5, 20)
    ]
};



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
class Controller {
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

        if (this.paused) {
            this.paused = false;
            app.ticker.start();                            
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




function run() {
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
        /*
        if (asteroids.some((asteroid) => collision(spaceship.sprite, asteroid.sprite))) {
            app.stop();
        }
        */

        // check for collisions between ship and land
        let collided = land.shape.intersects(spaceship.shape)
        spaceship.hit(collided);
    });



    // paint one frame if we started paused
    if (start_paused) {
        app.render();
    }
}
