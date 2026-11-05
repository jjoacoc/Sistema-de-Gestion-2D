<?php

namespace App\Http\Controllers;


class PanelController extends Controller
{
    // Muestra el panel general con el resumen del stock.
    // Más adelante aquí calcularemos los totales desde la base de datos.
    public function mostrar()
    {
        return view('panel');
    }
}