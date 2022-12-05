import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { A, D, DIRECTIONS, S, W } from './utils'


export class CharacterControls {

    model: THREE.Group
    mixer: THREE.AnimationMixer
    animationsMap: Map<string, THREE.AnimationAction> = new Map() // Walk, Run, Idle
    orbitControl: OrbitControls
    camera: THREE.Camera

    // state
    toggleRun: boolean = true
    currentAction: string

    // temporary data
    walkDirection = new THREE.Vector3()
    rotateAngle = new THREE.Vector3(0, 1, 0)
    rotateQuarternion: THREE.Quaternion = new THREE.Quaternion()
    cameraTarget = new THREE.Vector3()

    // constants
    fadeDuration: number = 0.2
    runVelocity = 5
    walkVelocity = 2
    jumpVelocity = 10

    constructor(model: THREE.Group,
        mixer: THREE.AnimationMixer, animationsMap: Map<string, THREE.AnimationAction>,
        orbitControl: OrbitControls, camera: THREE.Camera,
        currentAction: string) {
        this.model = model
        this.mixer = mixer
        this.animationsMap = animationsMap
        this.currentAction = currentAction
        this.animationsMap.forEach((value, key) => {
            if (key == currentAction) {
                value.play()
            }
        })
        this.orbitControl = orbitControl
        this.camera = camera;
        this.camera.position.z = 60;
        model.rotation.y = Math.PI;
        model.position.z = 60;
        this.updateCameraTarget(0, 0)
    }

    public switchRunToggle() {
        this.toggleRun = !this.toggleRun
    }


    jumping = false;
    public jump() {

        if(this.jumping) return;
        this.jumping = true;
        setTimeout(() => {
            this.jumping = false;
        }, 600);

    }

    public update(delta: number, keysPressed: any) {
        const directionPressed = DIRECTIONS.some(key => keysPressed[key] == true)
        var play = '';

        if (this.jumping) {
            play = 'jump'
        } else
            if (directionPressed && this.toggleRun) {
                play = 'run'
            } else if (directionPressed) {
                play = 'walk'
            }
            else {
                play = 'idle'
            }




        if (this.currentAction != play) {
            const toPlay = this.animationsMap.get(play)
            const current = this.animationsMap.get(this.currentAction)

            current.fadeOut(this.fadeDuration)
            toPlay.reset().fadeIn(this.fadeDuration).play();

            this.currentAction = play
        }

        this.mixer.update(delta)

        if (this.currentAction == 'run' || this.currentAction == 'walk' || this.currentAction == 'jump') {
            // calculate towards camera direction
            var angleYCameraDirection = Math.atan2(
                (this.camera.position.x - this.model.position.x),
                (this.camera.position.z - this.model.position.z))
            // diagonal movement angle offset
            var directionOffset = this.directionOffset(keysPressed)

            // rotate model
            this.rotateQuarternion.setFromAxisAngle(this.rotateAngle, angleYCameraDirection + directionOffset)
            this.model.quaternion.rotateTowards(this.rotateQuarternion, 0.2)

            // calculate direction
            this.camera.getWorldDirection(this.walkDirection)
            this.walkDirection.y = 0
            this.walkDirection.normalize()
            this.walkDirection.applyAxisAngle(this.rotateAngle, directionOffset)

            // run/walk velocity
            const velocity = this.currentAction == 'run' ? this.runVelocity : this.currentAction == 'jump' ? this.jumpVelocity : this.walkVelocity

            // move model & camera
            const moveX = this.walkDirection.x * velocity * delta
            const moveZ = this.walkDirection.z * velocity * delta


            this.model.position.x -= moveX
            this.model.position.z -= moveZ
            // console.log("position",this.model.position.x, ":",this.model.position.z,":",this.model.position.y);

            this.updateCameraTarget(moveX, moveZ)
        }
    }

    private updateCameraTarget(moveX: number, moveZ: number) {
        // move camera
        this.camera.position.x -= moveX
        this.camera.position.z -= moveZ
        // update camera target
        this.cameraTarget.x = this.model.position.x
        this.cameraTarget.y = this.model.position.y + 1
        this.cameraTarget.z = this.model.position.z
        this.orbitControl.target = this.cameraTarget
    }

    private directionOffset(keysPressed: any) {
        var directionOffset = Math.PI // w

        if (keysPressed[W]) {
            if (keysPressed[A]) {
                directionOffset = 5 * Math.PI / 4 // w+a
            } else if (keysPressed[D]) {
                directionOffset = 3 * Math.PI / 4// w+d
            }
        } else if (keysPressed[S]) {
            if (keysPressed[A]) {
                directionOffset = 7 * Math.PI / 4 // s+a
            } else if (keysPressed[D]) {
                directionOffset = 9 * Math.PI / 4  // s+d
            } else {
                directionOffset = 2 * Math.PI // s
            }
        } else if (keysPressed[A]) {
            directionOffset = -Math.PI / 2 // a
        } else if (keysPressed[D]) {
            directionOffset = Math.PI / 2 // d
        }

        return directionOffset
    }
}