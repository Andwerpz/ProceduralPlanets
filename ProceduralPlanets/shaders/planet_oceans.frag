#version 330 core
layout (location = 0) out vec4 gPosition;
layout (location = 1) out vec4 gNormal;
layout (location = 2) out vec4 gSpecular;
layout (location = 3) out vec4 gColor;

uniform vec3 camera_pos;

uniform sampler2D tex_position;
uniform sampler2D tex_color;
uniform sampler2D tex_frag_dir;
uniform sampler2D tex_normal_map;

uniform vec3 planet_pos;
uniform float planet_radius;

in vec2 frag_uv;

vec3 blendColors(vec3 minColor, vec3 maxColor, float min, float max, float x) {
	if(x < min) {
		return minColor;
	}
	else if(x > max) {
		return maxColor;
	}
	float minWeight = (max - x) / (max - min);
	float maxWeight = (x - min) / (max - min);
	float r = minColor.r * minWeight + maxColor.r * maxWeight;
	float g = minColor.g * minWeight + maxColor.g * maxWeight;
	float b = minColor.b * minWeight + maxColor.b * maxWeight;
	return vec3(r, g, b);
}

void main() {
	
	//problem is that we don't know the direction vectors of all fragments. 
	//the problematic ones are the fragments that we don't render to. 
	
	//could just render a far plane, but that solution is really jank. 
	//we can just sample the fragment direction from when we render the skybox
	
	//calculate the distance travelled through the sphere by the fragment ray
	
	//if it hits the terrain early, we can know by sampling the position map, then we update the distance accordingly. 
	
	//color of ocean is based off of intersection distance. 
	
	vec4 frag_color = texture(tex_color, frag_uv);
	vec3 frag_dir = normalize(texture(tex_frag_dir, frag_uv).rgb);
	vec4 frag_pos = texture(tex_position, frag_uv).rgba;
	
	//figure out if the ray intersects the sphere at all
	vec3 cameraToSphere = planet_pos - camera_pos;
	vec3 toClosestPoint = frag_dir * dot(frag_dir, cameraToSphere);
	
	if(dot(frag_dir, cameraToSphere) < 0) {
		discard;
	}
	
	float sphereRayDist = length(planet_pos - (camera_pos + toClosestPoint));
	
	if(sphereRayDist > planet_radius) {
		discard;
	}
	
	float intersectDiskRadius = sqrt(planet_radius * planet_radius - sphereRayDist * sphereRayDist);
	vec3 intersectPointNear = camera_pos + toClosestPoint - frag_dir * intersectDiskRadius;
	vec3 intersectPointFar = camera_pos + toClosestPoint + frag_dir * intersectDiskRadius;
	vec3 intersectPointNearNormal = normalize(intersectPointNear - planet_pos);
	
	float distToNear = length(camera_pos - intersectPointNear);
	float distToFar = length(camera_pos - intersectPointFar);
	
	float waterDepth = length(camera_pos - frag_pos.rgb) - distToNear;
	if(frag_color.a == 0) {
		waterDepth = distToFar - distToNear; 
	}
	
	if(waterDepth < 0) {
		discard;
	}
	
	vec3 surfaceColor = frag_color.rgb;
	if(frag_color.a == 0) {
		surfaceColor = vec3(1);
	}
	
	float waterAlphaMultiplier = 6;
	float waterDepthMultiplier = 2.1;
	float opticalDepth = 1 - exp(-waterDepth * waterDepthMultiplier);
	float waterAlpha = 1 - exp(-waterDepth * waterAlphaMultiplier);
	
	vec3 shallowWaterColor = vec3(133, 216, 229) / 255.0;
	vec3 deepWaterColor = vec3(2, 75, 134) / 255.0;
	
	vec3 blendedColor = mix(shallowWaterColor, deepWaterColor, opticalDepth);
	blendedColor = mix(frag_color.rgb, blendedColor, waterAlpha);
	
	//compute normal via triplanar mapping
	float xDot = abs(dot(vec3(-1, 0, 0), intersectPointNearNormal));
	float yDot = abs(dot(vec3(0, -1, 0), intersectPointNearNormal));
	float zDot = abs(dot(vec3(0, 0, -1), intersectPointNearNormal));
	
	float dotTotal = abs(xDot) + abs(yDot) + abs(zDot);
	
	float xDotWeight = xDot / dotTotal;
	float yDotWeight = yDot / dotTotal;
	float zDotWeight = zDot / dotTotal;
	
	float waterScale = 5;
	
	vec3 xNormal = texture(tex_normal_map, intersectPointNear.yz * waterScale).rgb;
	vec3 yNormal = texture(tex_normal_map, intersectPointNear.xz * waterScale).rgb;
	vec3 zNormal = texture(tex_normal_map, intersectPointNear.xy * waterScale).rgb;
	
	vec3 sampledNormal = xNormal * xDotWeight + yNormal * yDotWeight + zNormal * zDotWeight;
	
	blendedColor = vec3(xDotWeight, yDotWeight, zDotWeight);
	
	gColor.rgba = vec4(vec3(sampledNormal), 1.0);
	gSpecular.rgb = vec3(1);
	gSpecular.a = 64.0;
	gNormal.rgb = intersectPointNearNormal;
	gPosition.rgb = intersectPointNear;
	gPosition.a = 0.01;
	
} 

