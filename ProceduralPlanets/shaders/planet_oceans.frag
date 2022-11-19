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

const float PI = 3.14159265;

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

float atan2(float x, float y) {
	bool s = (abs(x) > abs(y));
	return mix(PI / 2.0 - atan(x, y),  atan(y, x), s);
}

mat3 createXRotMatrix(float rad) {
	return mat3(
		1, 0, 0,
		0, cos(rad), sin(rad),
		0, -sin(rad), cos(rad)
	);
}

mat3 createYRotMatrix(float rad) {
	return mat3(
		cos(rad), 0, -sin(rad),
		0, 1, 0,
		sin(rad), 0, cos(rad)
	);
}

void main() {
	vec4 frag_color = texture(tex_color, frag_uv);
	vec3 frag_dir = normalize(texture(tex_frag_dir, frag_uv).rgb);
	vec4 frag_pos = texture(tex_position, frag_uv).rgba;
	
	//figure out if the ray intersects the sphere at all
	vec3 cameraToSphere = planet_pos - camera_pos;
	vec3 toClosestPoint = frag_dir * dot(frag_dir, cameraToSphere);
	
	float sphereRayDist = length(planet_pos - (camera_pos + toClosestPoint));
	
	if(sphereRayDist > planet_radius) {
		discard;
	}
	
	float intersectDiskRadius = sqrt(planet_radius * planet_radius - sphereRayDist * sphereRayDist);
	
	vec3 toWaterNear = toClosestPoint - frag_dir * intersectDiskRadius;
	vec3 toWaterFar = toClosestPoint + frag_dir * intersectDiskRadius;
	
	vec3 waterNear = camera_pos + toClosestPoint - frag_dir * intersectDiskRadius;
	vec3 waterFar = camera_pos + toClosestPoint + frag_dir * intersectDiskRadius;
	vec3 waterNormal = normalize(waterNear - planet_pos);
	
	float distToNear = dot(toWaterNear, frag_dir);
	float distToFar = dot(toWaterFar, frag_dir);
	float distToSurface = dot(frag_pos.rgb - camera_pos, frag_dir);
	
	//check if sphere is intersected behind the camera
	if(distToNear < 0 && distToFar < 0) {
		discard;
	}
	
	distToNear = max(distToNear, 0);	//clamp near dist to camera, it usually can be behind the camera
	float waterDepth = 0;
	if(frag_color.a == 0) {
		waterDepth = distToFar - distToNear; 
	}
	else {
		waterDepth = distToSurface - distToNear;
	}
	
	if(waterDepth < 0){
		discard;
	}
	
	vec3 surfaceColor = frag_color.rgb;
	if(frag_color.a == 0) {
		surfaceColor = vec3(1);
	}
	
	float waterAlphaMultiplier = 3;
	float waterDepthMultiplier = 2.1;
	float opticalDepth = 1 - exp(-waterDepth * waterDepthMultiplier);
	float waterAlpha = 1 - exp(-waterDepth * waterAlphaMultiplier);
	
	vec3 shallowWaterColor = vec3(133, 216, 229) / 255.0;
	vec3 deepWaterColor = vec3(2, 75, 134) / 255.0;
	
	vec3 blendedColor = mix(shallowWaterColor, deepWaterColor, opticalDepth);
	blendedColor = mix(frag_color.rgb, blendedColor, waterAlpha);
	
	//compute normal via triplanar mapping
	float xDot = abs(dot(vec3(-1, 0, 0), waterNormal));
	float yDot = abs(dot(vec3(0, -1, 0), waterNormal));
	float zDot = abs(dot(vec3(0, 0, -1), waterNormal));
	
	float dotTotal = abs(xDot) + abs(yDot) + abs(zDot);
	
	float xDotWeight = xDot / dotTotal;
	float yDotWeight = yDot / dotTotal;
	float zDotWeight = zDot / dotTotal;
	
	float waterScale = 5;
	
	vec3 xNormal = texture(tex_normal_map, waterNear.yz * waterScale).rgb * 2.0 - 1.0;
	vec3 yNormal = texture(tex_normal_map, waterNear.xz * waterScale).rgb * 2.0 - 1.0;
	vec3 zNormal = texture(tex_normal_map, waterNear.xy * waterScale).rgb * 2.0 - 1.0;
	
	vec3 sampledNormal = xNormal * xDotWeight + yNormal * yDotWeight + zNormal * zDotWeight;
	
	vec3 waterNormal2 = waterNormal;
	
	float surfNormYRot = atan2(waterNormal.z, waterNormal.x);
	mat3 negYRotMat = createYRotMatrix(-surfNormYRot);
	waterNormal = negYRotMat * waterNormal;
	
	float surfNormXRot = atan2(waterNormal.y, waterNormal.z) - PI / 2.0;
	mat3 negXRotMat = createXRotMatrix(-surfNormXRot);
	waterNormal = negXRotMat * waterNormal;
	
	sampledNormal = transpose(negYRotMat) * transpose(negXRotMat) * sampledNormal;
	sampledNormal = normalize(sampledNormal);
	
	if(distToNear <= 0 && distToFar > 0){
		sampledNormal = waterNormal;
	}
	
	gColor.rgba = vec4(vec3(blendedColor), 1.0);
	gSpecular.rgb = vec3(1);
	gSpecular.a = 128.0;
	gNormal.rgb = sampledNormal;
	gPosition.rgb = waterNear;
	gPosition.a = 0.01;
	
} 

