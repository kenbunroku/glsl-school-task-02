precision mediump float;

attribute vec2 vPosition;
attribute vec2 vTexCoord;
attribute float nameOffset;

uniform mat4 mvpMatrix;
uniform float ratio;

varying vec2 texCoords;
varying float vRatio;
varying float vAlpha;

const float HALF_PI = 1.570796327;

void main() {
    texCoords = vTexCoord;

    float originY = -1.0;
    float maxOffsetX = 0.2;
    float maxOffsetY = 0.2;
    float maxOffsetZ = 0.5;

    // Translate to the new origin
    vec3 pos = vec3(vPosition.x, vPosition.y - originY, 0.0);

    // Existing rotation code
    float unsignedPosition = ((pos.x * 0.5 + 0.5) + (pos.y * 0.5 + 0.5)) / 2.0;
    float o = (nameOffset * 0.5 + unsignedPosition * 1.5) * 0.5;
    float merged = o + ratio * 2.0 - 1.0;
    float r = clamp(merged, 0.0, 1.0);
    vRatio = r;

    float angle = 4.0 * HALF_PI * r;
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    vec3 axis = normalize(vec3(1.0, 0.0, 0.0)); // Adjust if needed
    mat3 rotationMatrix = mat3(oc * axis.x * axis.x + c, oc * axis.x * axis.y - axis.z * s, oc * axis.z * axis.x + axis.y * s, oc * axis.x * axis.y + axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z - axis.x * s, oc * axis.z * axis.x - axis.y * s, oc * axis.y * axis.z + axis.x * s, oc * axis.z * axis.z + c);

    // Apply rotation
    pos = rotationMatrix * pos;

    // Translate back
    pos.y += originY;

    // Calculate vAlpha
    if(r < 0.2) {
        vAlpha = 1.0 - r / 0.2; // Decrease from 1.0 to 0.0 as r goes from 0.0 to 0.2
    } else if(r < 0.8) {
        vAlpha = 0.0; // Keep at 0.0 from r = 0.2 to r = 0.8
    } else {
        vAlpha = (r - 0.8) / 0.2; // Increase from 0.0 to 1.0 as r goes from 0.8 to 1.0
    }

    // Adjust Y position based on r
    if(r < 0.5) {
        pos.x += 2.0 * r * maxOffsetX;
        pos.y += 2.0 * r * maxOffsetY;
        pos.z += 2.0 * r * maxOffsetZ;
    } else {
        // When r is 0.5 to 1.0, move back to original position
        pos.x += 2.0 * (1.0 - r) * maxOffsetX;
        pos.y += 2.0 * (1.0 - r) * maxOffsetY;
        pos.z += 2.0 * (1.0 - r) * maxOffsetZ;
    }

    gl_Position = mvpMatrix * vec4(pos, 1.0);
    gl_PointSize = 5.0;
}
