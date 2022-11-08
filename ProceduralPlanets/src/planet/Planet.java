package planet;

import static org.lwjgl.opengl.GL11.*;

import java.util.ArrayList;
import java.util.HashMap;

import graphics.TextureMaterial;
import graphics.VertexArray;
import model.Model;
import util.MathUtils;
import util.NoiseGenerator;
import util.Vec3;

public class Planet {
	//needs to procedurally generate it's own mesh. 
	//vertex coloring? needs it's own shader as well if not. 

	private static int verticesPerEdge = 400;

	private Model model;

	private Vec3 pos, vel;
	private float radius;

	public Planet(Vec3 pos, float radius) {
		this.pos = new Vec3(pos);
		this.vel = new Vec3(0);
		this.radius = radius;

		this.generate();
	}

	private void generate() {
		assert verticesPerEdge >= 2 : "Can't generate cube with less than 2 vertices per edge";

		//generate cube vertices
		ArrayList<Vec3> vertices = new ArrayList<>();
		HashMap<String, Integer> verticesMap = new HashMap<>();

		int[][] top = new int[verticesPerEdge][verticesPerEdge];
		int[][] bottom = new int[verticesPerEdge][verticesPerEdge];
		int[][] left = new int[verticesPerEdge][verticesPerEdge];
		int[][] right = new int[verticesPerEdge][verticesPerEdge];
		int[][] near = new int[verticesPerEdge][verticesPerEdge];
		int[][] far = new int[verticesPerEdge][verticesPerEdge];

		for (int i = 0; i < verticesPerEdge; i++) {
			for (int j = 0; j < verticesPerEdge; j++) {
				int x, y, z;
				String vID;

				//top 
				x = j;
				y = verticesPerEdge - 1;
				z = verticesPerEdge - 1 - i;
				vID = x + " " + y + " " + z;
				if (verticesMap.containsKey(vID)) {
					top[i][j] = verticesMap.get(vID);
				}
				else {
					Vec3 next = new Vec3(x, y, z);
					top[i][j] = vertices.size();
					verticesMap.put(vID, vertices.size());
					vertices.add(next);
				}

				//bottom
				x = verticesPerEdge - 1 - j;
				y = 0;
				z = verticesPerEdge - 1 - i;
				vID = x + " " + y + " " + z;
				if (verticesMap.containsKey(vID)) {
					bottom[i][j] = verticesMap.get(vID);
				}
				else {
					Vec3 next = new Vec3(x, y, z);
					bottom[i][j] = vertices.size();
					verticesMap.put(vID, vertices.size());
					vertices.add(next);
				}

				//left
				x = 0;
				y = j;
				z = verticesPerEdge - 1 - i;
				vID = x + " " + y + " " + z;
				if (verticesMap.containsKey(vID)) {
					left[i][j] = verticesMap.get(vID);
				}
				else {
					Vec3 next = new Vec3(x, y, z);
					left[i][j] = vertices.size();
					verticesMap.put(vID, vertices.size());
					vertices.add(next);
				}

				//right
				x = verticesPerEdge - 1;
				y = verticesPerEdge - 1 - j;
				z = verticesPerEdge - 1 - i;
				vID = x + " " + y + " " + z;
				if (verticesMap.containsKey(vID)) {
					right[i][j] = verticesMap.get(vID);
				}
				else {
					Vec3 next = new Vec3(x, y, z);
					right[i][j] = vertices.size();
					verticesMap.put(vID, vertices.size());
					vertices.add(next);
				}

				//near
				x = j;
				y = verticesPerEdge - 1 - i;
				z = 0;
				vID = x + " " + y + " " + z;
				if (verticesMap.containsKey(vID)) {
					near[i][j] = verticesMap.get(vID);
				}
				else {
					Vec3 next = new Vec3(x, y, z);
					near[i][j] = vertices.size();
					verticesMap.put(vID, vertices.size());
					vertices.add(next);
				}

				//far
				x = verticesPerEdge - 1 - j;
				y = verticesPerEdge - 1 - i;
				z = verticesPerEdge - 1;
				vID = x + " " + y + " " + z;
				if (verticesMap.containsKey(vID)) {
					far[i][j] = verticesMap.get(vID);
				}
				else {
					Vec3 next = new Vec3(x, y, z);
					far[i][j] = vertices.size();
					verticesMap.put(vID, vertices.size());
					vertices.add(next);
				}

			}
		}

		//translate cube so that center is the origin
		Vec3 translate = new Vec3(-(verticesPerEdge - 1) / 2f);
		for (Vec3 v : vertices) {
			v.addi(translate);
		}

		//map cube to sphere
		for (Vec3 v : vertices) {
			v.normalize();

			float totalHeight = 0;

			float elevation = (float) NoiseGenerator.noise(v.x, v.y, v.z, 2, 1, 0.5, 2, 6);
			elevation = MathUtils.clamp(0, 10, elevation);
			elevation *= 0.8;
			//totalHeight += elevation;

			float cliffs = (float) NoiseGenerator.noise(v.x, v.y, v.z, 4, 1, 0.5, 2, 2);
			cliffs = -Math.abs(cliffs) + 1;
			cliffs = (float) Math.pow(cliffs, 2);

			//cliffs *= 2;

			totalHeight += cliffs * elevation;

			v.setLength(this.radius + totalHeight);
		}

		//convert to vertex array
		int[][][] sides = { top, bottom, left, right, near, far };
		ArrayList<Integer> indices = new ArrayList<>();
		for (int[][] side : sides) {
			for (int i = 0; i < verticesPerEdge - 1; i++) {
				for (int j = 0; j < verticesPerEdge - 1; j++) {
					int tl = side[i][j];
					int tr = side[i][j + 1];
					int bl = side[i + 1][j];
					int br = side[i + 1][j + 1];

					//check which diagonal has less length
					if (vertices.get(tl).sub(vertices.get(br)).length() < vertices.get(tr).sub(vertices.get(bl)).length()) {
						//tl to br diag shorter
						indices.add(bl);
						indices.add(tl);
						indices.add(br);

						indices.add(tr);
						indices.add(br);
						indices.add(tl);
					}
					else {
						//tr to bl diag shorter
						indices.add(bl);
						indices.add(tr);
						indices.add(br);

						indices.add(tr);
						indices.add(bl);
						indices.add(tl);
					}

				}
			}
		}

		float[] verticesArr = new float[vertices.size() * 3];
		float[] uvsArr = new float[vertices.size() * 2];
		int[] indicesArr = new int[indices.size()];

		for (int i = 0; i < vertices.size(); i++) {
			verticesArr[i * 3 + 0] = vertices.get(i).x;
			verticesArr[i * 3 + 1] = vertices.get(i).y;
			verticesArr[i * 3 + 2] = vertices.get(i).z;

			uvsArr[i * 2 + 0] = (float) Math.random();
			uvsArr[i * 2 + 1] = (float) Math.random();
		}

		for (int i = 0; i < indicesArr.length; i++) {
			indicesArr[i] = indices.get(i);
		}

		VertexArray vertexArray = new VertexArray(verticesArr, uvsArr, indicesArr, GL_TRIANGLES);

		this.model = new Model(vertexArray, TextureMaterial.defaultTextureMaterial());
	}

	public Model getModel() {
		return this.model;
	}

}