const DEG_TO_RAD = Math.PI / 180.0;
const EPSILON = 1e-4;
const MAX_BOUNCES = 3;
const SPP = 16;
const AA = 4;

class Color {
    constructor(r, g, b) {
        [this.r, this.g, this.b] = [r, g, b];
    }

    static corrected(r, g, b) {
        return new Color(Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2));
    }

    add(rhs) {
        return new Color(this.r + rhs.r, this.g + rhs.g, this.b + rhs.b);
    }

    sub(rhs) {
        return new Color(this.r - rhs.r, this.g - rhs.g, this.b - rhs.b);
    }

    mulScalar(rhs) {
        return new Color(this.r * rhs, this.g * rhs, this.b * rhs);
    }

    divScalar(rhs) {
        const reciprocal = 1.0 / rhs;
        return this.mulScalar(reciprocal);
    }

    mul(rhs) {
        return new Color(this.r * rhs.r, this.g * rhs.g, this.b * rhs.b);
    }
}

class Vec3 {
    constructor(x, y, z) {
        [this.x, this.y, this.z] = [x, y, z];
    }

    add(rhs) {
        return new Vec3(this.x + rhs.x, this.y + rhs.y, this.z + rhs.z);
    }

    sub(rhs) {
        return new Vec3(this.x - rhs.x, this.y - rhs.y, this.z - rhs.z);
    }

    mulScalar(rhs) {
        return new Vec3(this.x * rhs, this.y * rhs, this.z * rhs);
    }

    divScalar(rhs) {
        const reciprocal = 1.0 / rhs;
        return this.mulScalar(reciprocal);
    }

    dot(rhs) {
        return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
    }

    cross(rhs) {
        return new Vec3(
            this.y * rhs.z - this.z * rhs.y,
            this.z * rhs.x - this.x * rhs.z,
            this.x * rhs.y - this.y * rhs.x,
        );
    }

    length() {
        return Math.sqrt(this.dot(this));
    }

    normalize() {
        return this.divScalar(this.length());
    }

    reflect(v) {
        return v.sub(this.mulScalar(2 * this.dot(v)));
    }

    static randomUnit() {
        let p;
        do {
            p = new Vec3(Math.random(), Math.random(), Math.random()).mulScalar(2.0).sub(new Vec3(1, 1, 1));
        } while (p.dot(p) >= 1.0);
        return p;
    }
}

class Ray {
    constructor(origin, dir) {
        [this.origin, this.dir] = [origin, dir.normalize()];
    }

    pointAt(t) {
        return this.origin.add(this.dir.mulScalar(t));
    }
}

class Camera {
    constructor(origin, lookAt, up, vfov, aspect_ratio) {
        this.origin = origin;
        const theta = vfov * DEG_TO_RAD;
        const forward = origin.sub(lookAt).normalize();
        const right = up.cross(forward).normalize();
        const new_up = forward.cross(right);
        const half_rect_height = Math.tan(theta / 2);
        const half_rect_width = aspect_ratio * half_rect_height;
        const half_rect_height_scaled = new_up.mulScalar(half_rect_height);
        const half_rect_width_scaled = right.mulScalar(half_rect_width);
        const offset = half_rect_height_scaled.add(half_rect_width_scaled);
        this.lc = origin.sub(offset.add(forward));
        this.vertical = new_up.mulScalar(2 * half_rect_height);
        this.horizontal = right.mulScalar(2 * half_rect_width);
    }

    getRay(u, v) {
        const horizontal = this.horizontal.mulScalar(u);
        const vertical = this.vertical.mulScalar(v);
        const dir = this.lc.add(horizontal.add(vertical)).sub(this.origin).normalize();
        return new Ray(this.origin, dir);
    }
}

class SolidColor {
    constructor(color) {
        this.color = color;
    }

    sample(u, v) {
        return this.color;
    }
}

class Checkerboard {
    constructor(color1, color2, scale) {
        [this.color1, this.color2, this.scale] = [color1, color2, scale];
    }

    sample(u, v) {
        const t1 = (this.scale * u) & 1;
        const t2 = (this.scale * v) & 1;
        if (t1 ^ t2) {
            return this.color1;
        } else {
            return this.color2;
        }
    }
}

class Material {
    constructor(texture, reflectance) {
        [this.texture, this.reflectance] = [texture, reflectance];
    }

    brdf(is) {
        const newDir = is.normal.add(Vec3.randomUnit().mulScalar(1.0 - this.reflectance)).normalize();
        const newRay = new Ray(is.point, newDir);
        return newRay;
    }
}

class Sphere {
    constructor(pos, radius, material) {
        [this.pos, this.radius, this.material] = [pos, radius, material];
    }

    intersect(ray) {
        const to = ray.origin.sub(this.pos);
        const b = to.dot(ray.dir);
        const c = to.dot(to) - this.radius * this.radius;
        const d = b*b - c;
        if (d > EPSILON) {
            const d2 = Math.sqrt(d);

            let t = -b - d2;
            if (t > EPSILON) {
                const point = ray.pointAt(t);
                return {
                    t: t,
                    point: point,
                    normal: this.normal(point),
                    uv: this.uv(point),
                    object: this,
                }
            }
            t = -b + d2;
            if (t > EPSILON) {
                const point = ray.pointAt(t);
                return {
                    t: t,
                    point: point,
                    normal: this.normal(point),
                    uv: this.uv(point),
                    object: this,
                }
            }
        }
        return null;
/*
        const oc = ray.origin.sub(this.pos);
        const a = ray.dir.dot(ray.dir);
        const b = oc.dot(ray.dir);
        const c = oc.dot(oc);
        const d = b*b - a * c;
        if (d > 0) {
            let t = (-b - Math.sqrt(d))/a;
            if (t > EPSILON) {
                const point = ray.pointAt(t);
                return {
                    t: t,
                    point: point,
                    normal: this.normal(point),
                    uv: this.uv(point),
                    object: this,
                }
            }
            let t2 = (-b + Math.sqrt(d))/a;
            if (t2 > EPSILON) {
                const point = ray.pointAt(t2);
                return {
                    t: t2,
                    point: point,
                    normal: this.normal(point),
                    uv: this.uv(point),
                    object: this,
                }
            }
        }
        return null;*/
    }

    normal(pos) {
        return pos.sub(this.pos).normalize();
    }

    uv(pos) {
        const p = pos.sub(this.pos);
        const len = new Vec3(p.x, 0, p.z).length();
        const u = (Math.atan2(p.z, p.x) + Math.PI) / (2 * Math.PI);
        const v = (Math.atan2(p.y, len) + 0.5 * Math.PI) / Math.PI;
        return new Vec3(u, v, 0);
    }
}

function setPixel(imageData, x, y, color) {
    const y_inverted = imageData.height - y - 1;
    const index = (x + y_inverted * imageData.width) * 4;
    imageData.data[index + 0] = Math.pow(color.r, 1/2.2) * 255;
    imageData.data[index + 1] = Math.pow(color.g, 1/2.2) * 255;
    imageData.data[index + 2] = Math.pow(color.b, 1/2.2) * 255;
    imageData.data[index + 3] = 255;
}

function clamp(t, min, max) {
    if (t < min) {
        return min;
    } else if (t > max) {
        return max;
    } else {
        return t;
    }
}

class Scene {
    constructor() {
        this.objects = [];
    }

    add(o) {
        this.objects.push(o);
    }

    intersect(ray) {
        return this.objects
            .map((object) => object.intersect(ray))
            .reduce((acc, val) => {
                if (acc == null) {
                    return val;
                }
                if (val == null) {
                    return acc;
                }
                if (acc.t > val.t) {
                    return val;
                } else {
                    return acc;
                }
            });
    }
}

function sample(scene, ray, bounce) {
    if (bounce > MAX_BOUNCES) {
        return new Color(0, 0, 0);
    }

    // console.log(bounce);
    const is = scene.intersect(ray);
    if (is == null) {
        return new Color(0.9, 0.9, 0.9);
    }

    //const newDir = is.normal.add(Vec3.randomUnit()).normalize();
    //const newRay = new Ray(is.point, newDir);
    const newRay = is.object.material.brdf(is);
    const indirect = sample(scene, newRay, bounce + 1);
    const u = is.uv.x;
    const v = is.uv.y;

    return is.object.material.texture.sample(u, v).mul(indirect);
}

window.onload = () => {
    let canvas = document.getElementById('display');
    const rect = canvas.getBoundingClientRect();
    let context = canvas.getContext('2d');
    let imageData = context.createImageData(rect.width, rect.height);

    let scene = new Scene();
    const checkerboard1 = new Checkerboard(Color.corrected(0.9, 0.9, 0.9), Color.corrected(0.8, 0.2, 0.2), 20);
    scene.add(new Sphere(new Vec3(0, 0, 0), 0.5, new Material(new SolidColor(Color.corrected(0.9, 0.9, 0.9)), 0.0)));
    scene.add(new Sphere(new Vec3(0, -900, 0), 899.5, new Material(checkerboard1, 0.0)));

    const pos = new Vec3(-2.0, 0.0, 0.0);
    const at = new Vec3(0.0, 0.0, 0.0);
    const up = new Vec3(0.0, 1.0, 0.0);
    const camera = new Camera(pos, at, up, 90.0, rect.width / rect.height);

    const lightVec = new Vec3(1.0, 1.0, 0.0);
    for (let y = 0; y < rect.height; y++) {
        for (let x = 0; x < rect.width; x++) {
            let color = new Color(0, 0, 0);
            for (let a = 0; a < AA; a++) {
                const jittered_x = x + Math.random();
                const jittered_y = y + Math.random();
                const u = jittered_x / rect.width;
                const v = jittered_y / rect.height;
                let ray = camera.getRay(u, v);
                for (let s = 0; s < SPP; s++) {
                    color = color.add(sample(scene, ray, 0));
                }
            }
            color = color.divScalar(SPP * AA);
            setPixel(imageData, x, y, color, 255);
        }
    }
    context.putImageData(imageData, 0, 0);
}
