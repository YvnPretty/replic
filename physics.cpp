#include <emscripten/emscripten.h>
#include <cmath>
#include <cstdlib>
#include <vector>

const int NUM_PARTICLES = 1000;

// Estructura simple para representar escombros
struct Particle {
    float x, y, z;
    float vx, vy, vz;
    bool active;
};

std::vector<Particle> particles;

// Exponer un puntero a los datos (x, y, z de cada partícula) para que JS los lea
float positions[NUM_PARTICLES * 3];

extern "C" {

EMSCRIPTEN_KEEPALIVE
void init_simulation() {
    particles.resize(NUM_PARTICLES);
    for (int i = 0; i < NUM_PARTICLES; i++) {
        // Distribuir edificios en un piso plano
        particles[i].x = ((rand() % 1000) / 100.0f) - 5.0f; // -5 a 5
        particles[i].y = 0.5f; // Altura inicial sobre el piso
        particles[i].z = ((rand() % 1000) / 100.0f) - 5.0f; // -5 a 5
        
        particles[i].vx = 0;
        particles[i].vy = 0;
        particles[i].vz = 0;
        particles[i].active = false;
        
        positions[i*3] = particles[i].x;
        positions[i*3+1] = particles[i].y;
        positions[i*3+2] = particles[i].z;
    }
}

EMSCRIPTEN_KEEPALIVE
void update_simulation(float tornado_x, float tornado_z, float force) {
    for (int i = 0; i < NUM_PARTICLES; i++) {
        float dx = particles[i].x - tornado_x;
        float dz = particles[i].z - tornado_z;
        float dist = sqrt(dx*dx + dz*dz);
        
        // Si el tornado está cerca, se activan
        if (dist < 2.0f) {
            particles[i].active = true;
            // Fuerza centrípeta y ascendente
            particles[i].vx += (-dz * 0.1f - dx * 0.05f) * force;
            particles[i].vz += (dx * 0.1f - dz * 0.05f) * force;
            particles[i].vy += 0.2f * force; // Fuerza hacia arriba
        }
        
        if (particles[i].active) {
            // Aplicar gravedad
            particles[i].vy -= 0.01f; 
            
            // Actualizar posiciones
            particles[i].x += particles[i].vx;
            particles[i].y += particles[i].vy;
            particles[i].z += particles[i].vz;
            
            // Colisión con el piso
            if (particles[i].y < 0.5f) {
                particles[i].y = 0.5f;
                particles[i].vy = 0; // -particles[i].vy * 0.5f; (rebote)
                particles[i].vx *= 0.9f; // Fricción
                particles[i].vz *= 0.9f;
            }
        }
        
        // Actualizar array de posiciones para JS
        positions[i*3] = particles[i].x;
        positions[i*3+1] = particles[i].y;
        positions[i*3+2] = particles[i].z;
    }
}

EMSCRIPTEN_KEEPALIVE
float* get_positions_ptr() {
    return positions;
}

EMSCRIPTEN_KEEPALIVE
int get_num_particles() {
    return NUM_PARTICLES;
}

} // extern "C"
