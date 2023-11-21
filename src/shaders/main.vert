attribute vec2 position1;
attribute vec2 position2;
attribute float offset;

uniform mat4 mvpMatrix;
uniform float ratio;

varying float vAlpha;

const float HALF_PI = 1.570796327;

void main() {

    float unsignedPosition = (position1.x * 0.5 + 0.5);
    float o = (offset + unsignedPosition) * 0.5;
    float merged = o + ratio * 2.0 - 1.0;

    vec3 pos1 = vec3(position1, 0.0);
    vec3 pos2 = vec3(position2, 0.0);

    float r = clamp(merged, 0.0, 1.0);

    vec3 pos = mix(pos1, pos2, r);

    vec3 axis = normalize(vec3(0.0, 1.0, -1.0));

    // Rotation matrix around the axis
    float angle = 4.0 * HALF_PI * r;
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;

    mat3 rotationMatrix = mat3(oc * axis.x * axis.x + c, oc * axis.x * axis.y - axis.z * s, oc * axis.z * axis.x + axis.y * s, oc * axis.x * axis.y + axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z - axis.x * s, oc * axis.z * axis.x - axis.y * s, oc * axis.y * axis.z + axis.x * s, oc * axis.z * axis.z + c);

    // Apply rotation
    pos = rotationMatrix * pos;

     // Calculate vAlpha
    if(r < 0.2) {
        vAlpha = 1.0 - r / 0.2; // Decrease from 1.0 to 0.0 as r goes from 0.0 to 0.2
    } else if(r < 0.8) {
        vAlpha = 0.0; // Keep at 0.0 from r = 0.2 to r = 0.8
    } else {
        vAlpha = (r - 0.8) / 0.2; // Increase from 0.0 to 1.0 as r goes from 0.8 to 1.0
    }

    gl_Position = mvpMatrix * vec4(pos, 1.0);
    gl_PointSize = 2.0;
}
