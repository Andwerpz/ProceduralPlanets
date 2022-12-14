package state;

import static org.lwjgl.glfw.GLFW.*;
import static org.lwjgl.opengl.GL11.*;
import static org.lwjgl.opengl.GL12.*;
import static org.lwjgl.opengl.GL14.*;
import static org.lwjgl.opengl.GL13.*;
import static org.lwjgl.opengl.GL30.*;

import static org.lwjgl.openal.AL10.*;

import java.awt.Color;
import java.awt.Font;
import java.nio.FloatBuffer;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Queue;
import java.util.Stack;

import audio.Sound;
import entity.Capsule;
import entity.Entity;
import graphics.Framebuffer;
import graphics.Material;
import graphics.Texture;
import graphics.TextureMaterial;
import input.Button;
import input.Input;
import input.KeyboardInput;
import input.MouseInput;
import input.TextField;
import main.Main;
import model.AssetManager;
import model.Decal;
import model.FilledRectangle;
import model.Model;
import particle.Particle;
import planet.Planet;
import player.Camera;
import player.Player;
import scene.DirLight;
import scene.Light;
import scene.Scene;
import screen.PerspectiveScreen;
import screen.Screen;
import screen.UIScreen;
import server.GameClient;
import server.GameServer;
import ui.Text;
import ui.UIElement;
import ui.UIFilledRectangle;
import util.BufferUtils;
import util.FontUtils;
import util.Mat4;
import util.MathUtils;
import util.NetworkingUtils;
import util.NoiseGenerator;
import util.Pair;
import util.Vec3;
import util.Vec4;
import weapon.AK47;
import weapon.AWP;
import weapon.Deagle;
import weapon.M4A4;
import weapon.Usps;
import weapon.Weapon;

public class GameState extends State {

	private static final int WORLD_SCENE = 0;
	private static final int DECAL_SCENE = 1; // screen space decals
	private static final int PARTICLE_SCENE = 2;

	private static final int UI_SCENE = 3;

	private static final int PAUSE_SCENE_STATIC = 4;
	private static final int PAUSE_SCENE_DYNAMIC = 5;

	private PerspectiveScreen perspectiveScreen;
	private UIScreen uiScreen;

	private Player player;

	private boolean pauseMenuActive = false;

	private boolean playerControlsDisabled = false;

	private boolean leftMouse = false;
	private boolean rightMouse = false;

	private Planet planet;
	private float planetRadius = 20f;

	public GameState(StateManager sm) {
		super(sm);
	}

	@Override
	public void kill() {
		this.perspectiveScreen.kill();
		this.uiScreen.kill();
	}

	@Override
	public void load() {
		Main.lockCursor();
		Entity.killAll();

		this.perspectiveScreen = new PerspectiveScreen();
		this.uiScreen = new UIScreen();

		// -- WORLD SCENE --
		this.clearScene(WORLD_SCENE);
		Light.addLight(WORLD_SCENE, new DirLight(new Vec3(0.3f, -1f, -0.5f), new Vec3(0.8f), 0f));
		Scene.skyboxes.put(WORLD_SCENE, AssetManager.getSkybox("stars_skybox"));
		player = new Player(new Vec3(0), WORLD_SCENE);

		this.generatePlanet();

		// -- DECAL SCENE --
		this.clearScene(DECAL_SCENE);

		// -- UI SCENE --
		this.clearScene(UI_SCENE);

		// -- PAUSE SCENE --
		this.drawPauseMenu();

	}

	private void generatePlanet() {
		if (this.planet != null) {
			this.planet.kill();
		}

		this.planet = new Planet();
		long planetID = this.planet.addInstance(new Vec3(0, 0, 0), this.planetRadius, WORLD_SCENE);
		Model.updateInstance(planetID, new Material(new Vec3(1), new Vec3(1), 8f));
		NoiseGenerator.randomizeNoise();
	}

	private void togglePauseMenu() {
		if (this.pauseMenuActive) {
			this.pauseMenuActive = false;
			Main.lockCursor();
			this.enablePlayerControls();
		}
		else {
			this.pauseMenuActive = true;
			Main.unlockCursor();
			this.disablePlayerControls();
		}
	}

	private void drawPauseMenu() {
		// -- STATIC --
		this.clearScene(PAUSE_SCENE_STATIC);
		UIFilledRectangle backgroundRect = new UIFilledRectangle(0, 0, 0, 400, 350, PAUSE_SCENE_STATIC);
		backgroundRect.setFrameAlignmentStyle(UIElement.FROM_CENTER_LEFT, UIElement.FROM_CENTER_BOTTOM);
		backgroundRect.setContentAlignmentStyle(UIElement.ALIGN_CENTER, UIElement.ALIGN_CENTER);
		backgroundRect.setMaterial(new Material(new Vec4(0, 0, 0, 0.25f)));

		// -- DYNAMIC --
		this.clearScene(PAUSE_SCENE_DYNAMIC);
		Text pausedText = new Text(0, 0, "Paused", FontUtils.segoe_ui, 32, Color.WHITE, PAUSE_SCENE_DYNAMIC);
		pausedText.setFrameAlignmentStyle(UIElement.FROM_CENTER_LEFT, UIElement.FROM_CENTER_BOTTOM);
		pausedText.setContentAlignmentStyle(UIElement.ALIGN_CENTER, UIElement.ALIGN_CENTER);
	}

	private void enablePlayerControls() {
		if (!this.pauseMenuActive) {
			this.player.setAcceptPlayerInputs(true);
			this.playerControlsDisabled = false;
		}
	}

	private void disablePlayerControls() {
		this.player.setAcceptPlayerInputs(false);
		this.playerControlsDisabled = true;
	}

	@Override
	public void update() {

		// -- MENU --
		Input.inputsHovered(uiScreen.getEntityIDAtMouse());

		// -- UPDATES --
		Entity.updateEntities();
		Model.updateModels();
		updateCamera();

		// -- AUDIO --
		Sound.cullAllStoppedSources();
		Vec3 cameraPos = this.perspectiveScreen.getCamera().getPos();
		alListener3f(AL_POSITION, cameraPos.x, cameraPos.y, cameraPos.z);
		Vec3 cameraFacing = this.perspectiveScreen.getCamera().getFacing();
		Vec3 cameraUp = new Vec3(0, 1, 0);
		FloatBuffer cameraOrientation = BufferUtils.createFloatBuffer(new float[] { cameraFacing.x, cameraFacing.y, cameraFacing.z, cameraUp.x, cameraUp.y, cameraUp.z });
		alListenerfv(AL_ORIENTATION, cameraOrientation);

	}

	@Override
	public void render(Framebuffer outputBuffer) {
		//world
		perspectiveScreen.renderSkybox(false);
		perspectiveScreen.renderDecals(false);
		perspectiveScreen.renderPlayermodel(false);
		perspectiveScreen.renderParticles(false);
		perspectiveScreen.setWorldScene(WORLD_SCENE);
		perspectiveScreen.setDecalScene(DECAL_SCENE);
		perspectiveScreen.setParticleScene(PARTICLE_SCENE);
		perspectiveScreen.setPlanetRadius(this.planetRadius);
		perspectiveScreen.render(outputBuffer);

		//ui
		uiScreen.setUIScene(UI_SCENE);
		uiScreen.render(outputBuffer);

		if (this.pauseMenuActive) {
			uiScreen.setUIScene(PAUSE_SCENE_STATIC);
			uiScreen.render(outputBuffer);

			uiScreen.setUIScene(PAUSE_SCENE_DYNAMIC);
			uiScreen.render(outputBuffer);
		}

	}

	private void updateCamera() {
		perspectiveScreen.getCamera().setFacing(player.camXRot, player.camYRot);
		perspectiveScreen.getCamera().setPos(player.pos.add(Player.cameraVec).sub(perspectiveScreen.getCamera().getFacing().mul(0f))); //last part is for third person
		perspectiveScreen.getCamera().setUp(new Vec3(0, 1, 0));
	}

	@Override
	public void mousePressed(int button) {
		Input.inputsPressed(uiScreen.getEntityIDAtMouse());
		if (button == MouseInput.LEFT_MOUSE_BUTTON) {
			this.leftMouse = true;
		}
		else if (button == MouseInput.RIGHT_MOUSE_BUTTON) {
			this.rightMouse = true;
		}
	}

	@Override
	public void mouseReleased(int button) {
		Input.inputsReleased(uiScreen.getEntityIDAtMouse());
		if (button == MouseInput.LEFT_MOUSE_BUTTON) {
			this.leftMouse = false;
		}
		else if (button == MouseInput.RIGHT_MOUSE_BUTTON) {
			this.rightMouse = false;
		}

		String clickedButton = Input.getClicked();
		switch (clickedButton) {

		}
	}

	@Override
	public void keyPressed(int key) {
		switch (key) {
		case GLFW_KEY_ESCAPE:
			this.togglePauseMenu();
			break;

		case GLFW_KEY_G:
			this.generatePlanet();
			break;
		}
	}

	@Override
	public void keyReleased(int key) {

	}

}