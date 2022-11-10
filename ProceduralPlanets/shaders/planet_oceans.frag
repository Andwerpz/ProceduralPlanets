#version 330 core
layout (location = 0) out vec4 gPosition;
layout (location = 1) out vec4 gNormal;
layout (location = 2) out vec4 gSpecular;
layout (location = 3) out vec4 gColor;

uniform vec3 camera_pos;

uniform sampler2D tex_position;
uniform sampler2D tex_color;
uniform sampler2D tex_frag_dir;
uniform sampler2D tex_skybox_color;

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
		waterDepth = 100;	
		//fragments on the edge of the sphere might register as a really low value leading to a bright lining
		//if distToFar - distToNear is used.
		waterDepth = distToFar - distToNear; 
	}
	
	if(waterDepth < 0) {
		discard;
	}
	
	vec3 surfaceColor = frag_color.rgb;
	if(frag_color.a == 0) {
		surfaceColor = vec3(1);
	}
	
	vec3 shallowWaterColor = vec3(133, 216, 229) / 255.0;
	vec3 deepWaterColor = vec3(2, 75, 134) / 255.0;
	
	float shallowWaterDepth = 0.2;
	float deepWaterDepth = 1;
	
	vec3 blendedColor = blendColors(surfaceColor, shallowWaterColor, -0.05, shallowWaterDepth, waterDepth);
	if(waterDepth > shallowWaterDepth) {
		blendedColor = blendColors(shallowWaterColor, deepWaterColor, shallowWaterDepth, deepWaterDepth, waterDepth);
	}
	
	gColor.rgba = vec4(vec3(blendedColor), 1.0);
	gSpecular.rgb = vec3(1);
	gSpecular.a = 64f;
	gNormal.rgb = intersectPointNearNormal.rgb;
	gPosition.rgb = intersectPointNear;
	gPosition.a = 0.01;
	
} 

