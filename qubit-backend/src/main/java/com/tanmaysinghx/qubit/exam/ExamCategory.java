package com.tanmaysinghx.qubit.exam;

public enum ExamCategory {
    JEE_MAIN("JM"), JEE_ADVANCED("JA"), NEET_UG("NU"), BITSAT("BS"), CUET("CU"), OTHER("OT");

    private final String shortCode;

    ExamCategory(String shortCode) { this.shortCode = shortCode; }

    public String shortCode() { return shortCode; }
}
