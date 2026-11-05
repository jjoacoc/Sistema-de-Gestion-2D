<?php

namespace Database\Seeders;

use App\Models\Estante;
use Illuminate\Database\Seeder;

class EstanteSeeder extends Seeder
{
    public function run(): void
    {
        $estantes = [
            // Cada estante tiene distinta capacidad y distinta cantidad de prendas por fila
            ['nombre' => 'Estante A', 'posicion_x' => 60,  'posicion_y' => 60,  'ancho' => 220, 'alto' => 120, 'capacidad' => 6,  'por_fila' => 3],  // 2 filas de 3
            ['nombre' => 'Estante B', 'posicion_x' => 340, 'posicion_y' => 60,  'ancho' => 220, 'alto' => 120, 'capacidad' => 12, 'por_fila' => 5],  // 3 filas (5 + 5 + 2)
            ['nombre' => 'Estante C', 'posicion_x' => 620, 'posicion_y' => 60,  'ancho' => 220, 'alto' => 120, 'capacidad' => 4,  'por_fila' => 4],  // 1 fila de 4
            ['nombre' => 'Estante D', 'posicion_x' => 60,  'posicion_y' => 260, 'ancho' => 220, 'alto' => 120, 'capacidad' => 8,  'por_fila' => 4],  // 2 filas de 4
            ['nombre' => 'Estante E', 'posicion_x' => 340, 'posicion_y' => 260, 'ancho' => 220, 'alto' => 120, 'capacidad' => 5,  'por_fila' => 5],  // 1 fila de 5
        ];

        foreach ($estantes as $estante) {
            Estante::create($estante);
        }
    }
}