#version 330 core
layout (location = 0) out vec4 colorMap;
layout (location = 1) out vec4 dirMap;

in vec3 frag_dir;

uniform samplerCube skybox;

void main()
{	
	colorMap = vec4(texture(skybox, frag_dir).rgb, 1.0);
	
	dirMap = vec4(frag_dir, 1.0);
} 

